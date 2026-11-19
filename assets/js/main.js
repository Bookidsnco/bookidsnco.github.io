(function () {
	'use strict';

	var PC_MIN_WIDTH = 992;

	// 페이지가 어느 폴더에 있든 이미지 주소가 맞도록 이 스크립트 파일 위치(assets/js/)를 기준으로 계산
	var ASSETS_URL = new URL('../', document.currentScript.src).href;

	/* ------------------------------------------------------------------
	 * 스크롤 등장 효과
	 * 원본(아임웹)과 같은 규칙: 요소의 위쪽 끝이 화면 아래쪽 끝보다 위로 올라오면 재생.
	 * PC에서는 요소가 다시 화면 아래로 내려가면 초기화해서, 다시 내려올 때 또 재생됩니다.
	 * 모바일에서는 한 번만 재생합니다.
	 * ------------------------------------------------------------------ */
	var animItems = [].slice.call(document.querySelectorAll('[data-anim]'));

	function checkAnimations() {
		var isPC = window.innerWidth >= PC_MIN_WIDTH;
		var viewBottom = window.innerHeight;

		animItems.forEach(function (el) {
			// 숨겨진 쪽(.pc 또는 .mo) 화면의 요소는 건너뜀
			if (el.offsetParent === null) return;

			var target = el.querySelector('.a') || el;
			var visible = el.getBoundingClientRect().top < viewBottom;

			if (visible) {
				if (el.classList.contains('is-in')) return;
				target.style.animationName = el.getAttribute('data-anim');
				target.style.animationDuration = (el.getAttribute('data-dur') || '1') + 's';
				target.style.animationDelay = (el.getAttribute('data-delay') || '0') + 's';
				el.classList.add('is-in');
			} else if (isPC && el.classList.contains('is-in')) {
				el.classList.remove('is-in');
				target.style.animationName = '';
			}
		});
	}

	var animTimer = null;
	function scheduleAnimationCheck() {
		if (animTimer) return;
		animTimer = setTimeout(function () {
			animTimer = null;
			checkAnimations();
		}, 100);
	}

	window.addEventListener('load', scheduleAnimationCheck);
	window.addEventListener('scroll', scheduleAnimationCheck, { passive: true });
	window.addEventListener('resize', scheduleAnimationCheck);

	/* ------------------------------------------------------------------
	 * PC 첫 화면 눈 내리는 효과
	 * 원본은 three.js(캔버스 렌더러)로 그렸고, 같은 계산을 2D 캔버스로 옮겼습니다.
	 *   - 입자 150개, 위치는 -1000~1000 정육면체 안에서 무작위
	 *   - 속도 (0, -8, 0)을 X축 -45~45도, Y축 0~360도 회전 (30ms마다 이동)
	 *   - 카메라: 시야각 75도, z=1000 에서 원점을 바라봄
	 *   - 화면 크기 = 22px(입자 이미지) × 배율 × f × (높이/2) / 거리
	 *     (f = 1 / tan(37.5도), 섹션 높이가 1000 미만이면 배율 1.5)
	 * ------------------------------------------------------------------ */
	var snowHost = document.querySelector('.pc-hero');
	var snowBox = snowHost && snowHost.querySelector('.snow');

	if (snowBox) {
		var PARTICLE_COUNT = 150;
		var STEP_MS = 30;
		var CAMERA_Z = 1000;
		var FOCAL = 1 / Math.tan((75 / 2) * Math.PI / 180);
		var DEG = Math.PI / 180;

		var sprite = null;
		var canvas = null;
		var ctx = null;
		var particles = [];
		var width = 0;
		var height = 0;
		var spriteScale = 1;
		var frame = null;
		var lastTime = 0;
		var restartTimer = null;

		var randomRange = function (min, max) {
			return Math.random() * (max - min) + min;
		};

		var createParticle = function () {
			var ax = randomRange(-45, 45) * DEG;
			var ay = randomRange(0, 360) * DEG;
			// (0, -8, 0) → X축 회전 → Y축 회전
			var vy = -8 * Math.cos(ax);
			var vz = 8 * Math.sin(ax);
			return {
				x: randomRange(-1000, 1000),
				y: randomRange(-1000, 1000),
				z: randomRange(-1000, 1000),
				vx: vz * Math.sin(ay),
				vy: vy,
				vz: vz * Math.cos(ay)
			};
		};

		var step = function () {
			for (var i = 0; i < particles.length; i++) {
				var p = particles[i];
				p.x += p.vx;
				p.y += p.vy;
				p.z += p.vz;
				if (p.y < -1000) p.y += 2000;
				if (p.x > 1000) p.x -= 2000;
				else if (p.x < -1000) p.x += 2000;
				if (p.z > 1000) p.z -= 2000;
				else if (p.z < -1000) p.z += 2000;
			}
		};

		var draw = function () {
			ctx.clearRect(0, 0, width, height);
			if (!sprite || !sprite.complete || !sprite.naturalWidth) return;

			var aspect = width / height;
			var halfW = width / 2;
			var halfH = height / 2;
			// 먼 입자부터 그림
			var sorted = particles.slice().sort(function (a, b) { return a.z - b.z; });

			for (var i = 0; i < sorted.length; i++) {
				var p = sorted[i];
				var dist = CAMERA_Z - p.z;
				if (dist <= 1) continue; // 카메라 near 평면 안쪽은 원본에서도 그리지 않음
				var sx = halfW + (FOCAL / aspect) * p.x / dist * halfW;
				var sy = halfH - FOCAL * p.y / dist * halfH;
				var size = 22 * spriteScale * FOCAL * halfH / dist;
				if (sx + size < 0 || sx - size > width || sy + size < 0 || sy - size > height) continue;
				ctx.drawImage(sprite, sx - size / 2, sy - size / 2, size, size);
			}
		};

		var loop = function (now) {
			if (!lastTime) lastTime = now;
			var steps = Math.min(Math.floor((now - lastTime) / STEP_MS), 10);
			if (steps > 0) {
				lastTime += steps * STEP_MS;
				while (steps--) step();
				draw();
			}
			frame = requestAnimationFrame(loop);
		};

		var stopSnow = function () {
			if (frame) cancelAnimationFrame(frame);
			frame = null;
			lastTime = 0;
			if (canvas) canvas.remove();
			canvas = null;
		};

		var startSnow = function () {
			stopSnow();
			if (window.innerWidth < PC_MIN_WIDTH) return;

			// 모바일에서는 내려받지 않도록 PC 화면일 때만 불러옴
			if (!sprite) {
				sprite = new Image();
				sprite.src = ASSETS_URL + 'images/snow-particle.png';
			}

			width = snowHost.clientWidth;
			height = snowHost.clientHeight;
			if (!width || !height) return;
			spriteScale = height < 1000 ? 1.5 : 1;

			var ratio = Math.min(window.devicePixelRatio || 1, 2);
			canvas = document.createElement('canvas');
			canvas.width = Math.round(width * ratio);
			canvas.height = Math.round(height * ratio);
			canvas.style.width = width + 'px';
			canvas.style.height = height + 'px';
			ctx = canvas.getContext('2d');
			ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
			snowBox.appendChild(canvas);

			particles = [];
			for (var i = 0; i < PARTICLE_COUNT; i++) particles.push(createParticle());
			draw();
			frame = requestAnimationFrame(loop);
		};

		// 원본과 같이 1초 뒤 시작, 창 크기가 바뀌면 지우고 1초 뒤 다시 시작
		restartTimer = setTimeout(startSnow, 1000);
		window.addEventListener('resize', function () {
			stopSnow();
			clearTimeout(restartTimer);
			restartTimer = setTimeout(startSnow, 1000);
		});
	}
})();
