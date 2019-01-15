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
	const renderer = new THREE.WebGLRenderer();
	document.body.append(renderer.domElement);
	const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
	const scene = new THREE.Scene();
	scene.add(new THREE.PointLight());
	const cube = window.cube = new THREE.Mesh(new THREE.BoxBufferGeometry(1, 1, 1), new THREE.MeshLambertMaterial());
	cube.position.z = -3;
	scene.add(cube);
	renderer.render(scene, camera);

	const brfv4 = window.brfv4 = {};
	initializeBRF(brfv4);

	const vidReady = deferred();
	const resolution = new brfv4.Rectangle(0, 0, 1, 1);
	vid.addEventListener("loadeddata", () => {
		const w = vid.videoWidth;
		const h = vid.videoHeight;
		resolution.setTo(0, 0, w, h);
		renderer.setSize(w, h);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		canvas.width = w;
		canvas.height = h;
		vidReady.resolve();
	});
	navigator.mediaDevices.getUserMedia({video: true}).then(stream => {
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

	let lastTimestamp = 0;
	function update(timestamp) {
		requestAnimationFrame(update);
		if (!sdkReady.resolved || !vidReady.resolved) return;
		if (timestamp - lastTimestamp < 1000/30) return;
		lastTimestamp = timestamp;
		ctx.setTransform(-1, 0, 0, 1, resolution.width, 0);
		ctx.drawImage(vid, 0, 0, 640, 480);
		brfManager.update(ctx.getImageData(0, 0, 640, 480).data);
		const faces = brfManager.getFaces();
		if (faces.length) {
			const face = faces[0];
			if (face.state === brfv4.BRFState.FACE_TRACKING) {
				cube.material.color.set(0xffffff);
			} else {
				cube.material.color.set(0xff0000);
			}
			cube.rotation.x = face.rotationX * 2;
			cube.rotation.y = -face.rotationY;
			cube.rotation.z = -face.rotationZ;
			cube.position.x = face.points[27].x / resolution.width * 2 - 1;
			cube.position.y = -face.points[27].y / resolution.height * 2 + 1;
			cube.scale.setScalar(face.scale / 180);
		}
		renderer.render(scene, camera);
	}
	requestAnimationFrame(update);
})();
