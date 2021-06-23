import { SwingTwist } from './MotionDecoder.js';

export class VRMPoser {
	constructor(vrm) {
		this.vrm = vrm;
		this.root = vrm.scene;
		this.bones = new Array(BoneNames.length);
		this.axes = new Array(BoneNames.length);
		this.diameter = 10;

		const hips = vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName.Hips);
		this.humanScale = this.root.worldToLocal(hips.getWorldPosition(new THREE.Vector3())).y;

		BoneNames.forEach((boneName, i) => {
			const bone = vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName[boneName]);
			this.bones[i] = bone;
			if (bone) {
				const [relaxQ, tposeQ, sign] = BoneAxes[i];
				const q0 = bone.parent.getWorldQuaternion(new THREE.Quaternion());
				const q1 = bone.getWorldQuaternion(new THREE.Quaternion());
				q0.invert().multiply(new THREE.Quaternion(-relaxQ[0], -relaxQ[1], relaxQ[2], relaxQ[3])); // flip Z
				q1.invert().multiply(new THREE.Quaternion(-tposeQ[0], -tposeQ[1], tposeQ[2], tposeQ[3])); // flip Z
				this.axes[i] = [q0, q1.invert(), sign];
			}
		});
	}
	update(motions) {
		const boneQ = new Float32Array(4);
		for (let i = 0; i < BoneNames.length; i++) {
			const bone = this.bones[i];
			if (bone) {
				const [boneT, boneR, boneS] = motions[i];
				const [q0, q1, sign] = this.axes[i];
				if (isNaN(boneR[3]))
					SwingTwist(boneQ, sign * boneR[0], sign * boneR[1], sign * boneR[2]);
				else
					boneQ.set(boneR);

				const q = new THREE.Quaternion(-boneQ[0], -boneQ[1], boneQ[2], boneQ[3]); // flip Z
				q.premultiply(q0).multiply(q1);
				bone.rotation.setFromQuaternion(q, "XYZ", true);

				if (!isNaN(boneR[3])) {
					const t = new THREE.Vector3(boneT[0], boneT[1], -boneT[2]); // flip Z
					const s = boneS / this.humanScale;
					t.x -= Math.round(t.x / this.diameter) * this.diameter;
					t.y -= Math.round(t.y / this.diameter) * this.diameter;
					t.z -= Math.round(t.z / this.diameter) * this.diameter;
					bone.position.copy(bone.parent.worldToLocal(this.root.localToWorld(t)));
					bone.scale.set(s, s, s);
				}
			}
		}
	}
};

const BoneNames = [
	"Hips",
	"LeftUpperLeg", "RightUpperLeg",
	"LeftLowerLeg", "RightLowerLeg",
	"LeftFoot", "RightFoot",
	"Spine",
	"Chest",
	"Neck",
	"Head",
	"LeftShoulder", "RightShoulder",
	"LeftUpperArm", "RightUpperArm",
	"LeftLowerArm", "RightLowerArm",
	"LeftHand", "RightHand",
	"LeftToes", "RightToes",
	"LeftEye", "RightEye",
	"Jaw",
	"LeftThumbProximal", "LeftThumbIntermediate", "LeftThumbDistal",
	"LeftIndexProximal", "LeftIndexIntermediate", "LeftIndexDistal",
	"LeftMiddleProximal", "LeftMiddleIntermediate", "LeftMiddleDistal",
	"LeftRingProximal", "LeftRingIntermediate", "LeftRingDistal",
	"LeftLittleProximal", "LeftLittleIntermediate", "LeftLittleDistal",
	"RightThumbProximal", "RightThumbIntermediate", "RightThumbDistal",
	"RightIndexProximal", "RightIndexIntermediate", "RightIndexDistal",
	"RightMiddleProximal", "RightMiddleIntermediate", "RightMiddleDistal",
	"RightRingProximal", "RightRingIntermediate", "RightRingDistal",
	"RightLittleProximal", "RightLittleIntermediate", "RightLittleDistal",
	"UpperChest",
];
const BoneAxes = [
	[[+0.00000, +0.00000, +0.00000, +1.00000], [+0.00000, +0.00000, +0.00000, +1.00000], +1], // Hips
	[[-0.62644, +0.34855, -0.59144, +0.36918], [-0.50952, +0.48977, -0.48105, +0.51876], +1], // LeftUpperLeg
	[[+0.36918, +0.59144, +0.34855, +0.62644], [+0.51876, +0.48105, +0.48977, +0.50952], +1], // RightUpperLeg
	[[+0.71450, -0.04313, -0.69691, +0.04422], [+0.51894, -0.48097, -0.50616, +0.49312], +1], // LeftLowerLeg
	[[+0.04422, +0.69691, -0.04313, -0.71450], [+0.49312, +0.50616, -0.48097, -0.51894], +1], // RightLowerLeg
	[[-0.50000, +0.50000, -0.50000, +0.50000], [-0.50000, +0.50000, -0.50000, +0.50000], +1], // LeftFoot
	[[+0.50000, +0.50000, +0.50000, +0.50000], [+0.50000, +0.50000, +0.50000, +0.50000], +1], // RightFoot
	[[+0.46815, +0.52994, -0.46815, -0.52994], [+0.46815, +0.52994, -0.46815, -0.52994], +1], // Spine
	[[+0.52661, +0.47189, -0.52661, -0.47189], [+0.52661, +0.47189, -0.52661, -0.47189], +1], // Chest
	[[+0.46642, +0.53160, -0.46748, -0.53040], [+0.46642, +0.53160, -0.46748, -0.53040], +1], // Neck
	[[-0.50000, -0.50000, +0.50000, +0.50000], [-0.50000, -0.50000, +0.50000, +0.50000], +1], // Head
	[[+0.00261, -0.03047, -0.08517, -0.99590], [+0.00261, -0.03047, -0.08517, -0.99590], -1], // LeftShoulder
	[[+0.99590, -0.08518, +0.03047, +0.00261], [+0.99590, -0.08518, +0.03047, +0.00261], -1], // RightShoulder
	[[-0.00420, -0.24793, -0.35282, -0.90224], [+0.00010, -0.00419, -0.02326, -0.99972], -1], // LeftUpperArm
	[[+0.90224, -0.35282, +0.24793, -0.00420], [+0.99972, -0.02326, +0.00419, +0.00010], -1], // RightUpperArm
	[[+0.52201, -0.47584, -0.47697, -0.52305], [+0.70648, -0.02834, -0.02988, -0.70654], -1], // LeftLowerArm
	[[+0.52305, -0.47697, +0.47584, +0.52202], [+0.70654, -0.02988, +0.02834, +0.70648], -1], // RightLowerArm
	[[+0.00004, -0.04117, -0.00109, -0.99915], [+0.00004, -0.04117, -0.00109, -0.99915], -1], // LeftHand
	[[+0.99915, -0.00109, +0.04117, +0.00004], [+0.99915, -0.00109, +0.04117, +0.00004], -1], // RightHand
	[[+0.70711, +0.00000, +0.70711, +0.00000], [+0.70711, +0.00000, +0.70711, +0.00000], +1], // LeftToes
	[[+0.00000, -0.70711, +0.00000, -0.70711], [+0.00000, -0.70711, +0.00000, -0.70711], +1], // RightToes
	[[-0.70711, +0.00000, +0.70711, +0.00000], [-0.70711, +0.00000, +0.70711, +0.00000], +1], // LeftEye
	[[+0.00000, +0.70711, +0.00000, -0.70711], [+0.00000, +0.70711, +0.00000, -0.70711], +1], // RightEye
	null, // Jaw
	[[-0.58070, -0.45060, +0.25516, -0.62821], [-0.65871, -0.29491, +0.25711, -0.64267], -1], // LeftThumbProximal
	[[-0.70013, -0.13590, +0.09906, -0.69392], [-0.66711, -0.26935, +0.23444, -0.65380], -1], // LeftThumbIntermediate
	[[-0.70013, -0.13590, +0.09906, -0.69392], [-0.66711, -0.26935, +0.23444, -0.65380], -1], // LeftThumbDistal
	[[+0.15036, +0.02227, +0.94561, -0.28760], [+0.07773, +0.00016, +0.99697, -0.00204], -1], // LeftIndexProximal
	[[+0.05321, +0.01854, +0.94281, -0.32854], [+0.05634, +0.00093, +0.99827, -0.01654], -1], // LeftIndexIntermediate
	[[+0.05321, +0.01854, +0.94281, -0.32854], [+0.05634, +0.00093, +0.99827, -0.01654], -1], // LeftIndexDistal
	[[+0.06963, +0.00934, +0.94994, -0.30443], [+0.03295, +0.00060, +0.99929, -0.01826], -1], // LeftMiddleProximal
	[[+0.01913, +0.00746, +0.93156, -0.36300], [+0.02051, +0.00108, +0.99839, -0.05279], -1], // LeftMiddleIntermediate
	[[+0.01913, +0.00746, +0.93156, -0.36300], [+0.02051, +0.00108, +0.99839, -0.05279], -1], // LeftMiddleDistal
	[[+0.00104, +0.03589, -0.29463, -0.95494], [+0.00002, -0.00251, -0.00784, -0.99997], -1], // LeftRingProximal
	[[+0.00186, -0.00600, -0.29653, -0.95500], [-0.00011, -0.00628, +0.01768, -0.99982], -1], // LeftRingIntermediate
	[[+0.00186, -0.00600, -0.29653, -0.95500], [-0.00011, -0.00628, +0.01768, -0.99982], -1], // LeftRingDistal
	[[+0.00044, +0.07607, -0.29066, -0.95380], [+0.00000, -0.00035, -0.00435, -0.99999], -1], // LeftLittleProximal
	[[-0.00770, +0.02491, -0.29538, -0.95502], [+0.00049, +0.02607, +0.01878, -0.99948], -1], // LeftLittleIntermediate
	[[-0.00770, +0.02491, -0.29538, -0.95502], [+0.00049, +0.02607, +0.01878, -0.99948], -1], // LeftLittleDistal
	[[+0.62827, +0.25540, +0.45053, -0.58057], [-0.64270, -0.25738, -0.29486, +0.65860], -1], // RightThumbProximal
	[[+0.69394, +0.09930, +0.13583, -0.70010], [-0.65382, -0.23468, -0.26929, +0.66703], -1], // RightThumbIntermediate
	[[+0.69394, +0.09930, +0.13583, -0.70010], [-0.65382, -0.23468, -0.26929, +0.66703], -1], // RightThumbDistal
	[[-0.28761, -0.94561, +0.02227, -0.15036], [+0.00204, +0.99697, -0.00016, +0.07773], -1], // RightIndexProximal
	[[-0.32854, -0.94281, +0.01854, -0.05320], [+0.01654, +0.99827, -0.00093, +0.05633], -1], // RightIndexIntermediate
	[[-0.32854, -0.94281, +0.01854, -0.05320], [+0.01654, +0.99827, -0.00093, +0.05633], -1], // RightIndexDistal
	[[-0.30443, -0.94994, +0.00934, -0.06962], [+0.01826, +0.99929, -0.00060, +0.03295], -1], // RightMiddleProximal
	[[-0.36299, -0.93157, +0.00746, -0.01913], [+0.05278, +0.99840, -0.00108, +0.02050], -1], // RightMiddleIntermediate
	[[-0.36299, -0.93157, +0.00746, -0.01913], [+0.05278, +0.99840, -0.00108, +0.02050], -1], // RightMiddleDistal
	[[-0.95494, +0.29463, +0.03589, -0.00104], [+0.99997, -0.00784, +0.00251, +0.00002], -1], // RightRingProximal
	[[-0.95500, +0.29654, -0.00599, -0.00186], [+0.99982, +0.01767, +0.00627, -0.00011], -1], // RightRingIntermediate
	[[-0.95500, +0.29654, -0.00599, -0.00186], [+0.99982, +0.01767, +0.00627, -0.00011], -1], // RightRingDistal
	[[-0.95380, +0.29066, +0.07606, -0.00044], [+0.99999, -0.00435, +0.00036, +0.00000], -1], // RightLittleProximal
	[[-0.95503, +0.29537, +0.02490, +0.00770], [+0.99948, +0.01879, -0.02606, +0.00049], -1], // RightLittleIntermediate
	[[-0.95503, +0.29537, +0.02490, +0.00770], [+0.99948, +0.01879, -0.02606, +0.00049], -1], // RightLittleDistal
	[[+0.56563, +0.42434, -0.56563, -0.42434], [+0.56563, +0.42434, -0.56563, -0.42434], +1], // UpperChest
];