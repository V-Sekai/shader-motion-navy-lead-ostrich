import { fetchArrayBuffer } from "../fetch.js";
import { extenLoaders, imageLoaders } from "../loader.js";

const decoderURLs = Object.fromEntries(["uastc_bc7", "uastc_astc", "uastc_rgba32_srgb"].map(x =>
	[x, `https://raw.githubusercontent.com/KhronosGroup/Universal-Texture-Transcoders/main/build/${x}.wasm`]));

const UnivTexDecoder = {
	load(name) {
		if(this.decoders === undefined) {
			this.decoders = {};
			this.memory = new WebAssembly.Memory({ initial: 1 });
			this.page = 0;
		}
		if(this.decoders[name] === undefined)
			this.decoders[name] = (async name => (await WebAssembly.instantiate(
				await fetchArrayBuffer(decoderURLs[name]), {env: {memory: this.memory}})).instance.exports)(name);
		return this.decoders[name];
	},
	realloc(page) {
		if(this.page < page)
			this.memory.grow(page - this.page), this.page = page;
		return this.memory.buffer;
	},
	async transcode(name, width, height, compressedData) {
		const decoder = await this.load(name);
		return func => {
			const nBlocks = ((width + 3) >> 2) * ((height + 3) >> 2);
			const length = nBlocks * 16;
			const buffer = this.realloc((length + 65535) >> 16);
			new Uint8Array(buffer, 65536, length).set(compressedData);
			console.assert(decoder.transcode(nBlocks) === 0);
			return func(new Uint8Array(buffer, 65536, length));
		};
	},
	async decodeRGBA32(name, width, height, compressedData) {
		const decoder = await this.load(name);
		return func => {
			const xBlocks = (width + 3) >> 2, yBlocks = (height + 3) >> 2;
			const inputLength = xBlocks * yBlocks * 16;
			const outputLength = width * height * 4;
			const buffer = this.realloc((inputLength + width * yBlocks * 16 + 65535) >> 16);
			new Uint8Array(buffer, 65536, inputLength).set(compressedData);
			console.assert(decoder.decodeRGBA32(width, height) === 0);
			return func(new Uint8Array(buffer, 65536 + inputLength, outputLength));
		};
	},
};

extenLoaders["GOOGLE_texture_basis"] = true;
extenLoaders["PIXIV_texture_basis"] = true;
imageLoaders["image/basis"] = (data, img) => gl => {
	const _data$$ = data.then(basis => {
		// https://github.com/BinomialLLC/basis_universal/blob/master/transcoder/basisu_file_headers.h
		const header = new DataView(basis.buffer, basis.byteOffset);
		const offset = header.getUint32(65/*m_slice_desc_file_ofs*/, true);
		const slice = new DataView(header.buffer, header.byteOffset+offset); // take first slice
		const width = slice.getUint16(5/*m_orig_width*/, true), height = slice.getUint16(7/*m_orig_height*/, true);
		const file = basis.subarray(slice.getUint32(13/*m_file_ofs*/, true), slice.getUint32(17/*m_file_size*/, true));

		img.extras = { width: width, height: height };
		let ext;
		if(ext = gl && gl.getExtension("EXT_texture_compression_bptc")) {
			Object.assign(img.extras, { compressed: true, format: null, type: null,
				internalformat: ext.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT});
			return UnivTexDecoder.transcode("uastc_bc7", width, height, file);
		}
		if(ext = gl && gl.getExtension("WEBGL_compressed_texture_astc")) {
			Object.assign(img.extras, { compressed: true, format: null, type: null,
				internalformat: ext.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR});
			return UnivTexDecoder.transcode("uastc_astc", width, height, file);
		}
		return UnivTexDecoder.decodeRGBA32("uastc_rgba32_srgb", width, height, file);
	});
	return { then(onFulfilled, onRejected) {
		return _data$$.then(data$$ => data$$(onFulfilled), onRejected) }};
};