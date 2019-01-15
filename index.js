function deferred() {
	const deferred = {resolved: false};
	deferred.promise = new Promise(res => { 
		deferred.resolve = () => {
			res();
			deferred.resolved = true;
		};
	});
	return deferred;
}

(async () => {
	const ginger = window.ginger = new Ginger();
	ginger.gingerPivot.position.y = 5.5;
	ginger.init();

	const brfv4 = window.brfv4 = {};
	initializeBRF(brfv4);

	const vidReady = deferred();
	const resolution = new brfv4.Rectangle(0, 0, 1, 1);
	vid.addEventListener("loadeddata", () => {
		const w = vid.videoWidth;
		const h = vid.videoHeight;
		resolution.setTo(0, 0, w, h);
		canvas.width = w;
		canvas.height = h;
		vidReady.resolve();
	});
	navigator.mediaDevices.getUserMedia({video: {facingMode: "user"}}).then(stream => {
		vid.srcObject = stream;
	});

	const sdkReady = deferred();
	const sdkReadyInterval = setInterval(() => {
		if (!brfv4.sdkReady) return;
		clearInterval(sdkReadyInterval);
		sdkReady.resolve();
	}, 100);

	await Promise.all([vidReady.promise, sdkReady.promise]);

	const brfManager = window.brfManager = new brfv4.BRFManager();
	brfManager.setMode(brfv4.BRFMode.FACE_TRACKING);
	brfManager.setNumFacesToTrack(1);
	brfManager.setFaceDetectionRoi(resolution);
	brfManager.init(resolution, resolution, "brfv4_ginger");
	const size =  Math.min(resolution.width, resolution.height);
	brfManager.setFaceDetectionParams(size * 0.20, size * 1.00, 12, 8);
	brfManager.setFaceTrackingStartParams(size * 0.20, size * 1.00, 32, 35, 32);
	brfManager.setFaceTrackingResetParams(size * 0.15, size * 1.00, 40, 55, 32);

	const ctx = canvas.getContext("2d");

	function mapclamp(s, v, a, b, c, d) {
		return THREE.Math.clamp(THREE.Math.mapLinear(v * s, a, b, c, d), Math.min(c, d), Math.max(c, d));
	}

	function show() {
		info.textContent = Array.from(arguments).map(x => x.toFixed(3)).join("\n");
	}

	let lastTimestamp = 0;
	function update(timestamp) {
		requestAnimationFrame(update);
		if (!sdkReady.resolved || !vidReady.resolved) return;
		if (timestamp - lastTimestamp < 1000/30) return;
		lastTimestamp = timestamp;
		ctx.setTransform(-1, 0, 0, 1, resolution.width, 0);
		ctx.drawImage(vid, 0, 0, resolution.width, resolution.height);
		brfManager.update(ctx.getImageData(0, 0, resolution.width, resolution.height).data);
		const faces = brfManager.getFaces();
		let tracked = false;
		if (faces.length) {
			const face = faces[0];
			if (face.state === brfv4.BRFState.FACE_TRACKING) {
				ginger.gingerPivot.rotation.x = face.rotationX * 1 - 10 * Math.PI / 180;
				ginger.gingerPivot.rotation.y = -face.rotationY;
				ginger.gingerPivot.rotation.z = -face.rotationZ;
				ginger.gingerPivot.position.x = face.points[27].x / resolution.width * 3 - 1.5;
				ginger.gingerPivot.position.y = -face.points[27].y / resolution.height * 2 + 6;
				ginger.gingerPivot.scale.setScalar(face.scale / 200);

				const scaleFactor = 200 / face.scale

				const lidDistance = face.points[43].y - face.points[47].y;
				ginger.controls.eyes.morph.value = mapclamp(scaleFactor, lidDistance, -21, -9, -1, 1);

				const mouthWidth = face.points[64].x - face.points[60].x;
				ginger.controls.lipsync.morph.value = mapclamp(scaleFactor, mouthWidth, 112, 60, -1, 0.8);

				ginger.controls.expression.morph.value = mapclamp(scaleFactor, mouthWidth, 77, 112, 0, 1);
				const browDistance = face.points[24].x - face.points[19].x;
				let expression = ginger.controls.expression.morph.value;

				if (expression < 0.005) {
					const faceWidth = face.points[14].x - face.points[2].x;
					ginger.controls.expression.morph.value = mapclamp(240 / faceWidth, browDistance, 127, 137, -0.7, 0);
					expression = ginger.controls.expression.morph.value;
				}

				const mouthHeight = face.points[66].y - face.points[62].y;
				ginger.controls.jawrange.morph.value = THREE.Math.clamp(mapclamp(scaleFactor, mouthHeight, 6, 36, 0, 1) - (expression > 0 ? expression / 2 : 0), 0, 1);


				ginger.morph();

				tracked = true;
			}
		} 

		if (!tracked) {
			ginger.gingerPivot.rotation.set(0, 0, 0);
			ginger.gingerPivot.position.x = 0;
			ginger.gingerPivot.position.y = 5.5;
			ginger.gingerPivot.scale.setScalar(1);
			ginger.controls.jawrange.morph.value = 0;
			ginger.controls.eyes.morph.value = 1;
			ginger.controls.expression.morph.value = 0;
			ginger.morph();
		}
	}
	requestAnimationFrame(update);
})();
