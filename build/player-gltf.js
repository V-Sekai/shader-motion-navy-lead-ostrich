import { mat4 } from "./lib/gl-matrix.js";
import { GLContext } from "./lib/wgl-fast.js";

import * as GLTF from "./lib/GLTF/index.js";
import * as wGLTF from "./lib/wGLTF/index.js";
import { CreatePlayer } from "./lib/SM/MeshPlayer.js";
import { AnimRecorder } from "./lib/SM/AnimRecorder.js";
import { MotionDecoder } from "./lib/SM/MotionDecoder.js";
import { MotionLayout } from "./lib/SM/MotionLayout.js";
import { HumanPose } from "./lib/SM/HumanPoser.js";

import Shader_MeshPlayer from "../shader/MeshPlayer.js";
import Shader_VideoDecoder from "../shader/VideoDecoder.js";

export function createSMMContext(gl) {
  const techniques = createTechniques(gl);
  const textures = createTextures(gl);
  const decoder = {
    technique: techniques.VideoDecoder,
    uniforms: {
      _MainTex_ST: [1, 1, 0, 0],
      _MainTex: { index$: textures.motion },
    },
  };
  return {
    techniques: techniques,
    textures: textures,
    uniforms: {
      motionST: decoder.uniforms._MainTex_ST,
    },
    renderDecoder(gl) {
      textures.motionDec.needsUpdate = true;
      gl.bindFramebuffer(gl.FRAMEBUFFER, textures.motionDec.framebuffer);
      gl.viewport(0, 0, 40, 45);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      if (wGLTF.useProgram(gl, decoder.technique.program$)) {
        wGLTF.bindUniforms(gl, decoder.uniforms, decoder.technique);
        gl.bindVertexArray(null); // safari: avoid drawArrays generating INVALID_OPERATION
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
    },
  };
}
function createTechniques(gl) {
  const gltf = GLTF.loadGLTF(
    {
      buffers: [{}],
      bufferViews: [{ buffer: 0 }],
      images: [
        {
          bufferView: 0,
          extras: {
            type: gl.UNSIGNED_BYTE,
            internalformat: gl.RGBA,
            width: 1,
            height: 1,
          },
        },
      ],
      samplers: [
        {
          wrapS: gl.CLAMP_TO_EDGE,
          wrapT: gl.CLAMP_TO_EDGE,
          magFilter: gl.NEAREST,
          minFilter: gl.NEAREST,
        },
      ],
      textures: [{ source: 0, sampler: 0 }],
    },
    Uint8Array.of(255, 255, 255, 255)
  );

  const techMeshPlayer = {
    attributes: {
      in_POSITION0: { semantic: "POSITION" },
      in_NORMAL0: { semantic: "NORMAL" },
      in_TEXCOORD0: { semantic: "_TEXCOORD_0" },
      in_TEXCOORD1: { semantic: "_TEXCOORD_1" },
    },
    uniforms: {
      unity_ObjectToWorld: { type: gl.FLOAT_MAT4, semantic: "MODEL" },
      unity_MatrixVP: { type: gl.FLOAT_MAT4, semantic: "VIEWPROJECTION" },

      _RotationTolerance: { type: gl.FLOAT, value: 0.1 },
      _HumanScale: { type: gl.FLOAT, value: -1 },
      _Layer: { type: gl.FLOAT, value: 0 },

      _MotionDec: { type: gl.SAMPLER_2D },
      _Bone: { type: gl.SAMPLER_2D },
      _Shape: { type: gl.SAMPLER_2D },
      _MainTex: { type: gl.SAMPLER_2D, value: { index$: gltf.textures[0] } },
      _MainTex_ST: { type: gl.FLOAT_VEC4, value: [1, 1, 0, 0] },
      _Color: { type: gl.FLOAT_VEC4, value: [1, 1, 1, 1] },
    },
  };
  const ext = GLTF.loadTechniques({
    shaders: [
      { type: gl.VERTEX_SHADER, _data: Promise.resolve(Shader_MeshPlayer.vs) },
      {
        type: gl.FRAGMENT_SHADER,
        _data: Promise.resolve(Shader_MeshPlayer.fs),
      },
      {
        type: gl.FRAGMENT_SHADER,
        _data: Promise.resolve(Shader_MeshPlayer.fs.replace(/\bdiscard;/, ";")),
      },
      {
        type: gl.VERTEX_SHADER,
        _data: Promise.resolve(Shader_VideoDecoder.vs),
      },
      {
        type: gl.FRAGMENT_SHADER,
        _data: Promise.resolve(Shader_VideoDecoder.fs),
      },
    ],
    programs: [
      { vertexShader: 0, fragmentShader: 2 },
      { vertexShader: 0, fragmentShader: 1 },
      { vertexShader: 3, fragmentShader: 4 },
    ],
    techniques: [
      { program: 0, ...techMeshPlayer },
      {
        program: 1,
        ...techMeshPlayer,
        uniforms: {
          ...techMeshPlayer.uniforms,
          _Cutoff: { type: gl.FLOAT, value: 0, semantic: "ALPHACUTOFF" },
        },
      },
      {
        program: 2,
        uniforms: {
          _MainTex: { type: gl.SAMPLER_2D },
          _MainTex_ST: { type: gl.FLOAT_VEC4, value: [1, 1, 0, 0] },
        },
      },
    ],
  });
  ext.programs.forEach((prog) => wGLTF.loadProgram(gl, prog)); // preload shader programs
  return {
    MeshPlayer: ext.techniques[0],
    MeshPlayerAlphaTest: ext.techniques[1],
    VideoDecoder: ext.techniques[2],
  };
}

function createTextures(gl) {
  const bufferRGBA = new Uint8Array(40 * 45 * 4);
  const bufferFloat = new Float32Array(40 * 45);
  const gltf = GLTF.loadGLTF(
    {
      buffers: [{}],
      bufferViews: [{ buffer: 0 }],
      images: [
        {
          uri: "motion/default.png",
          extras: { internalformat: gl.RGBA, flipY: true },
        }, // firefox doesn't support sRGB video texture
        {
          bufferView: 0,
          extras: {
            type: gl.UNSIGNED_BYTE,
            internalformat: gl.RGBA,
            width: 40,
            height: 45,
          },
        },
      ],
      samplers: [
        {
          wrapS: gl.CLAMP_TO_EDGE,
          wrapT: gl.CLAMP_TO_EDGE,
          magFilter: gl.LINEAR,
          minFilter: gl.LINEAR,
        },
        {
          wrapS: gl.CLAMP_TO_EDGE,
          wrapT: gl.CLAMP_TO_EDGE,
          magFilter: gl.NEAREST,
          minFilter: gl.NEAREST,
        },
      ],
      textures: [
        { source: 0, sampler: 0 },
        { source: 1, sampler: 1 },
      ],
    },
    bufferRGBA,
    location.href
  );
  const motion = gltf.textures[0];
  const motionDec = gltf.textures[1];
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    wGLTF.loadTexture(gl, motionDec),
    0
  );
  return {
    motion: motion,
    motionDec: Object.assign(motionDec, {
      needsUpdate: false,
      framebuffer: framebuffer,
      readPixels() {
        if (this.needsUpdate) {
          this.needsUpdate = false;
          gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffer);
          gl.readPixels(0, 0, 40, 45, gl.RGBA, gl.UNSIGNED_BYTE, bufferRGBA);
          for (let i = 0; i < 40 * 45; i++)
            bufferFloat[i] =
              (((bufferRGBA[i * 4 + 3] / 0x100 + bufferRGBA[i * 4 + 2]) /
                0x100 +
                bufferRGBA[i * 4 + 1]) /
                0x100 +
                bufferRGBA[i * 4]) /
                0x40 -
              1;
        }
        return bufferFloat;
      },
    }),
  };
}

import { OrbitControls } from "./script2/OrbitControls.js";
import { FPSCounter, resizeCanvas, downloadFile } from "./script2/util.js";
import {
  getCaptureClientRect,
  getDisplaySurface,
} from "./script2/ScreenCapture.js";

let getCaptureRect;
let motionDec;
const avatars = {};
const $video = document.querySelector("#video");
const $canvas = document.querySelector("#canvas");
const $embed = document.querySelector("#embed");
const $overlay = document.querySelector("#overlay");
const $source = document.querySelector("#source");
{
  let sourceStream;
  const $sourceFile = document.querySelector("#sourceFile");
  const $sourceUrl = document.querySelector("#sourceUrl");
  $source.onclick = function () {
    this.dataset.value = this.value;
  };
  $source.onchange = function () {
    if (this.value === "file:") {
      this.value = this.dataset.value;
      return openFiles($sourceFile, (files) => {
        for (const file of files)
          this.value = addOption(this, URL.createObjectURL(file), file.name);
        this.onchange();
      });
    }
    if (this.value === "url:") {
      this.value = this.dataset.value;
      $source.hidden = true;
      $sourceUrl.hidden = false;
      $sourceUrl.focus();
      $sourceUrl.select();
      return;
    }
    if (this.value === "cap:") {
      this.value = this.dataset.value;
      captureScreen().then(
        () => (this.value = "cap:"),
        (e) => alert(e)
      );
      return;
    }
    if (this.value.startsWith("embed:")) {
      const value = this.value;
      this.value = this.dataset.value;
      $embed.src = value.slice(6);
      return captureEmbed().then(
        () => (this.value = value),
        (e) => alert(e)
      );
    }
    setStream(null);
    $embed.src = "";
    $embed.hidden = true;
    $video.hidden = false;
    $video.srcObject = sourceStream;
    $video.src = this.value;
    $video.muted = false;
  };
  $sourceUrl.form.onsubmit = function (event) {
    if (event) event.preventDefault();
    $sourceUrl.hidden = true;
    $source.hidden = false;
    const url = $sourceUrl.value;
    if (url) {
      const { name, embed_url, raw_url } = resolveURL(url);
      if (embed_url !== undefined) {
        $embed.src = embed_url; // preload
        return captureEmbed().then(
          () => {
            $source.value = addOption($source, `embed:${embed_url}`, name);
            $source.onchange();
          },
          (e) => alert(e)
        );
      } else {
        $source.value = addOption($source, raw_url, name);
        $source.onchange();
      }
    }
  };
  window.onhashchange = function (event) {
    const url = location.hash.replace(/^#/, "");
    if (/(^https?:)|(^\w\/)/.test(url)) {
      $overlay.innerText = "Click here to play";
      $overlay.hidden = false;
      $overlay.addEventListener(
        "pointerdown",
        (event) => {
          $overlay.hidden = true;
          $sourceUrl.value = url;
          $sourceUrl.form.onsubmit();
        },
        { once: true }
      );
    }
  };
  window.onhashchange();
  async function captureScreen() {
    $overlay.innerText = "You will see a popup asking you to share screen";
    $overlay.hidden = false;

    const constraints = {
      audio: false,
      video: {
        cursor: "false",
        displaySurface: { ideal: "window" },
        frameRate: { ideal: 60 },
        height: { max: 480 }, // restrict for performance
      },
    };
    try {
      if (!navigator.mediaDevices)
        throw new Error(`screen capture not available`);
      setStream(await navigator.mediaDevices.getDisplayMedia(constraints));
    } finally {
      $overlay.hidden = true;
    }

    $video.srcObject = sourceStream;
    $video.hidden = false;
    $embed.hidden = true;
  }
  async function captureEmbed() {
    if ($embed.hidden || !sourceStream.active) {
      const title = document.title;
      document.title = "👉 SELECT ME TO SHARE 👈";
      $overlay.innerText =
        "You will see a popup asking you to share screen\nPlease share this browser tab or application window instead";
      $overlay.hidden = false;

      const constraints = {
        audio: false,
        video: {
          cursor: "false",
          displaySurface: { ideal: "browser" },
          frameRate: { ideal: 60 },
          height: { max: 480 }, // restrict for performance
        },
      };
      try {
        if (!navigator.mediaDevices)
          throw new Error(`screen capture not available`);
        setStream(await navigator.mediaDevices.getDisplayMedia(constraints));
      } finally {
        document.title = title;
        $overlay.hidden = true;
      }

      const displaySurface = getDisplaySurface(sourceStream.getTracks()[0]);
      if (!(getCaptureRect = getCaptureClientRect[displaySurface]))
        throw new Error(`displaySurface "${displaySurface}" not supported`);

      $video.srcObject = sourceStream;
      $video.hidden = true;
      $embed.hidden = false;
    }
    const footer = document.querySelector("footer");
    $overlay.innerText = "Click page bottom to play";
    $overlay.hidden = false;
    $overlay.onpointermove = function (event) {
      const box = footer.getBoundingClientRect();
      if (
        box.left <= event.clientX &&
        event.clientX <= box.right &&
        box.top <= event.clientY &&
        event.clientY <= box.bottom
      ) {
        $overlay.hidden = true;
        $overlay.onpointermove = null;
      }
    };
  }
  function setStream(stream) {
    if (sourceStream) sourceStream.getTracks().forEach((track) => track.stop());
    sourceStream = stream;
  }
  function embedURL(url) {
    return `video.html?${performance.now() >> 0}#${url}`;
  }
  function resolveURL(url) {
    let m;
    if ((m = url.match(/^(\w\/[A-Za-z0-9_\/.\-]+)/)))
      return { name: `${m[1]}`, raw_url: `//vsk.lox9973.com/${m[1]}.mp4` };
    if (
      (m = url.match(
        /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([A-Za-z0-9_\-]+)/
      ))
    )
      return {
        name: `youtube:${m[1]}`,
        embed_url: `https://www.youtube.com/embed/${m[1]}`,
      };
    if ((m = url.match(/twitch\.tv\/([A-Za-z0-9_\-]+)/)))
      return {
        name: `twitch:${m[1]}`,
        embed_url: `https://player.twitch.tv/?channel=${m[1]}&autoplay=false&parent=${location.hostname}`,
      };
    if ((m = url.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_\-]+)/)))
      return {
        name: `googledrive:${m[1]}`,
        embed_url: embedURL(`https://drive.google.com/uc?id=${m[1]}`),
      };
    return { name: url.split("/").pop(), embed_url: embedURL(url) };
  }
}
const $record = document.querySelector("#record");
const $recordTime = document.querySelector("#recordingTime");
{
  const $export = document.querySelector("#export");
  const $debug = document.querySelector("#debug");
  $record.onchange = function () {
    if (this.checked)
      for (const avatar of Object.values(avatars)) {
        avatar.humanPose = new HumanPose();
        avatar.animRecorder = new AnimRecorder(() => {
          avatar.motionDecoder.Update(
            {
              width: 40,
              height: 45,
              getData: motionDec.readPixels.bind(motionDec),
            },
            avatar.layer
          );
          avatar.humanPose.SetBoneSwingTwists(avatar.motionDecoder.motions);
          avatar.humanPose.SetHipsPositionRotation(
            ...avatar.motionDecoder.motions[0]
          );
          return {
            muscles: avatar.humanPose.muscles,
            rootT: avatar.humanPose.bodyPosition,
            rootQ: avatar.humanPose.bodyRotation,
          };
        });
      }
    else
      for (const avatar of Object.values(avatars)) {
        const url = URL.createObjectURL(avatar.animRecorder.SaveToClip());
        downloadFile(url, `mocap${avatar.layer}.anim`);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
  };
}
let updateAvatars;
const $avatars = Array.from({ length: 2 }, (_, i) =>
  document.querySelector(`#avatar${i}`)
);
{
  const $avatarFile = document.querySelector("#avatarFile");
  $avatars.forEach(($avatar) => {
    $avatar.onclick = function () {
      this.dataset.value = this.value;
    };
    $avatar.onchange = function () {
      if (this.value === "file:") {
        this.value = this.dataset.value;
        return openFiles($avatarFile, (files) => {
          for (const file of files) this.value = addAvatarOption(file);
          this.onchange();
        });
      }
      updateAvatars();
    };
  });
  $canvas.ondragover = function (event) {
    event.preventDefault();
  };
  $canvas.ondrop = function (event) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return;
    if (file.name.endsWith(".vrm")) {
      for (const $avatar of $avatars)
        if ($avatar.value) {
          $avatar.value = addAvatarOption(file);
          $avatar.onchange();
          break;
        }
    } else if (file.name.endsWith(".mp4")) {
      $source.value = addOption($source, URL.createObjectURL(file), file.name);
      $source.onchange();
    }
  };
  function addAvatarOption(file) {
    const url = URL.createObjectURL(file);
    for (const $select of $avatars) addOption($select, url, file.name);
    return url;
  }
}
// camera
const camera = {
  znear: 0.1,
  zfar: 100,
  yfov: (45 / 180) * Math.PI, // in radians
  targetPos: [0, -1, 0],
};
const controls = new OrbitControls(camera, $canvas);
controls.keyReset = "Escape";

main();
function main() {
  const _gl = $canvas.getContext("webgl2", {
    failIfMajorPerformanceCaveat: true, // disable software rendering because it's 2fps
    premultipliedAlpha: true,
    antialias: !/Mobi/.test(navigator.userAgent), // disable MSAA on mobile
  });
  if (!_gl) {
    alert(
      "Unable to initialize WebGL. Your browser or machine may not support it."
    );
    return;
  }
  const gl = GLContext(_gl);

  const glob = createSMMContext(gl);
  motionDec = glob.textures.motionDec;
  Object.assign(glob.uniforms, {
    matrixVP: mat4.create(),
  });

  {
    const models = new Map();
    updateAvatars = function () {
      for (const [i, $avatar] of $avatars.entries()) {
        let avatar = avatars[i];
        if ((avatar ? avatar.src : "") === $avatar.value) continue;

        if (!$avatar.value) {
          console.log(`delete avatar[${i}]`);
          delete avatars[i];
          continue;
        }
        if (!avatar) {
          console.log(`create avatar[${i}]`);
          avatars[i] = avatar = {
            layer: i,
            motionDecoder: new MotionDecoder(new MotionLayout()),
          };
        }

        avatar.src = $avatar.value;
        if (!models.has($avatar.value))
          models.set($avatar.value, loadModel(gl, $avatar.value, glob));
        models.get($avatar.value).then((model) => {
          console.log(`load avatar[${i}]: ${avatar.src}`);
          avatar.draws = model.draws.map((draw) => ({
            __proto__: draw,
            uniforms: { __proto__: draw.uniforms, _Layer: avatar.layer },
          }));
        });
      }
    };
    updateAvatars();
  }

  const $fps = document.querySelector("#fps");
  const $videoRegion = document.querySelector("#videoRegion");
  let lastTimeStamp = 0;
  const fpsCounter = new FPSCounter();
  requestAnimationFrame(drawFrame);
  function drawFrame(timeStamp) {
    // frame time
    $fps.textContent = Math.round(fpsCounter.update(timeStamp));
    glob.uniforms.time = timeStamp * 1e-3;
    glob.uniforms.deltaTime = (timeStamp - lastTimeStamp) * 1e-3;
    lastTimeStamp = timeStamp;

    const motionST = glob.uniforms.motionST;
    if (!$embed.hidden) {
      const box = $videoRegion.getBoundingClientRect();
      const cap = getCaptureRect(window);
      motionST[0] = box.width / cap.width;
      motionST[1] = box.height / cap.height;
      motionST[2] = (box.x - cap.x) / cap.width;
      motionST[3] = (box.y - cap.y) / cap.height;
      motionST[3] = 1 - motionST[3] - motionST[1]; // flipY
    } else {
      motionST[0] = 1;
      motionST[1] = 1;
      motionST[2] = 0;
      motionST[3] = 0;
    }

    // motion video
    if ($video.readyState >= $video.HAVE_CURRENT_DATA && $video.videoWidth) {
      gl.bindTexture(
        gl.TEXTURE_2D,
        wGLTF.loadTexture(gl, glob.textures.motion)
      );
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        $video
      );
    }
    glob.renderDecoder(gl);

    // camera
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    mat4.perspective(
      glob.uniforms.matrixVP,
      camera.yfov,
      aspect,
      camera.znear,
      camera.zfar
    );
    controls.multiplyMatrixV(glob.uniforms.matrixVP);
    mat4.translate(
      glob.uniforms.matrixVP,
      glob.uniforms.matrixVP,
      camera.targetPos
    );
    mat4.scale(glob.uniforms.matrixVP, glob.uniforms.matrixVP, [-1, 1, 1]);

    resizeCanvas(gl);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 0), gl.clearDepth(1 /*FAR*/);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // avatars
    const draws = Object.values(avatars)
      .flatMap((avatar) => avatar.draws || [])
      .sort((x, y) => x.renderOrder - y.renderOrder);
    for (const draw of draws)
      if (wGLTF.useProgram(gl, draw.technique.program$)) {
        gl.frontFace(draw.mirror ? gl.CW : gl.CCW);
        wGLTF.setStates(gl, draw.material);
        wGLTF.bindUniforms(gl, draw.uniforms, draw.technique);
        wGLTF.bindAttributes(gl, draw.primitive.attributes$, draw.technique);
        wGLTF.drawPrimitive(gl, draw.primitive);
      }

    if ($record.checked)
      for (const avatar of Object.values(avatars))
        if (avatar.animRecorder.currentTime < 60) {
          avatar.animRecorder.TakeSnapshot(glob.uniforms.deltaTime);
          $recordTime.textContent = `${avatar.animRecorder.currentTime.toFixed(
            0
          )}s`;
        }
    requestAnimationFrame(drawFrame);
  }
}
async function loadModel(gl, modelURL, glob) {
  const url = new URL(modelURL, location.href);
  const gltf = GLTF.loadGLTF(...(await GLTF.fetchGLTF(url)), url);
  // console.debug("GLTF", gltf);

  const vrm = (gltf.extensions || {}).VRM;
  const mesh = vrm ? CreatePlayer(gltf) : gltf.meshes[0];

  const renderOrderMap = { OPAQUE: 2000, MASK: 2450, BLEND: 3000 };
  const matrixM = mat4.create();

  const draws = mesh.primitives.map((prim, i) => {
    const {
      alphaMode = "OPAQUE",
      alphaCutoff = 0.5,
      pbrMetallicRoughness: {
        baseColorTexture: mainTexInfo,
        baseColorFactor: mainColor = [1, 1, 1, 1],
      },
      extras: { boneTexture: boneTexInfo, shapeTexture: shapeTexInfo },
    } = prim.material$;
    const {
      renderQueue: renderOrder = renderOrderMap[alphaMode],
      floatProperties: { _ZWrite: depthWrite } = {},
    } = (vrm && vrm.materialProperties[prim.material]) || {};
    const tech =
      glob.techniques[
        alphaMode === "MASK" || depthWrite
          ? "MeshPlayerAlphaTest"
          : "MeshPlayer"
      ];
    return {
      renderOrder: renderOrder,
      mirror: !vrm,
      primitive: prim,
      technique: tech,
      material: {
        __proto__: prim.material$,
        depthWrite: depthWrite,
      },
      uniforms: {
        MODEL: matrixM,
        VIEWPROJECTION: glob.uniforms.matrixVP,
        ALPHACUTOFF: alphaCutoff,
        _Color: mainColor,
        _MainTex: mainTexInfo,
        _Bone: boneTexInfo,
        _Shape: shapeTexInfo,
        _MotionDec: { index$: glob.textures.motionDec },
      },
    };
  });
  return { draws: draws };
}
function openFiles($file, callback) {
  $file.onchange = () => $file.files.length && callback($file.files);
  return $file.click();
}
function addOption($select, value, text) {
  const $option = document.createElement("option");
  ($option.value = value), ($option.text = text);
  $select.add($option);
  return value;
}
