/*
 * 사이트 공통 기능. 어느 페이지든 이 파일과 assets/css/site.css 만 넣으면 아래 기능이 동작합니다.
 *   - 오른쪽 위 언어 전환 (고른 언어 저장)
 *   - 바닥글 등의 회사 이름 (data-company-name)
 *   - 이용약관 · 개인정보처리방침 팝업 (?mode=policy, ?mode=privacy)
 *   - 파일로 직접 열었을 때(file://) 폴더 링크 보정
 *   - 마우스 오른쪽 버튼 메뉴와 Ctrl/Command + C 막기 (원본 사이트 설정)
 * 페이지 언어는 <html lang="..."> 으로 판단합니다.
 */
(function () {
	'use strict';

	// 첫 화면(/)의 언어 선택(index.html)과 같은 이름을 써야 함
	var LANGUAGE_KEY = 'bookids-language';
	var language = (document.documentElement.lang || 'ko').slice(0, 2) === 'en' ? 'en' : 'ko';

	/* ------------------------------------------------------------------
	 * 언어 전환
	 * 주소의 /kr/ko/ ↔ /kr/en/ 부분만 바꿔서 같은 페이지의 다른 언어로 갑니다.
	 * 그래서 새 페이지도 한국어·영어 폴더 이름만 같게 만들면 따로 손댈 필요가 없습니다.
	 * ------------------------------------------------------------------ */
	var LANGUAGE_PATH = /\/kr\/(ko|en)\//;

	[].forEach.call(document.querySelectorAll('a[data-language]'), function (link) {
		var target = link.getAttribute('data-language');
		if (LANGUAGE_PATH.test(location.pathname)) {
			link.href = location.pathname.replace(LANGUAGE_PATH, '/kr/' + target + '/');
		}
		link.addEventListener('click', function () {
			// 저장소를 막아 둔 브라우저에서는 저장만 건너뜀
			try { localStorage.setItem(LANGUAGE_KEY, target); } catch (e) {}
		});
	});

	/* 파일로 직접 열면 폴더 주소가 index.html 을 열어 주지 않으므로 붙여 줌 (서버에서는 아무 일도 하지 않음) */
	if (location.protocol === 'file:') {
		[].forEach.call(document.querySelectorAll('a[href]'), function (link) {
			if (link.protocol === 'file:' && /\/$/.test(link.pathname)) link.pathname += 'index.html';
		});
	}

	/* ------------------------------------------------------------------
	 * 회사 이름
	 * data-company-name 이 붙은 요소(바닥글 등)를 이 값으로 채웁니다. 회사 이름이 바뀌면 여기만 고치면 됩니다.
	 * 페이지에는 이름을 적지 않고 비워 두므로, 자바스크립트가 꺼져 있으면 그 자리가 비어 보입니다.
	 * ------------------------------------------------------------------ */
	var COMPANY_NAME = 'Bookidsnco';

	[].forEach.call(document.querySelectorAll('[data-company-name]'), function (element) {
		element.textContent = COMPANY_NAME;
	});

	/* ------------------------------------------------------------------
	 * 이용약관 · 개인정보처리방침 팝업
	 * 원본(아임웹)과 같이 주소에 ?mode=policy(이용약관), ?mode=privacy(개인정보처리방침)가 있으면 열리고,
	 * data-policy 가 붙은 링크를 누르면 주소는 그대로 두고 팝업만 엽니다. (닫아도 주소는 바꾸지 않음)
	 * 내용은 Firebase Hosting 에 올린 약관 페이지에서 불러옵니다. 다른 주소에서 불러오므로
	 * firebase.json 에 Access-Control-Allow-Origin 헤더가 있어야 하고, 불러오지 못하면 그 페이지로 이동합니다.
	 * ------------------------------------------------------------------ */
	var POLICY_HOST = 'https://bookidsnco.firebaseapp.com';
	var POLICIES = {
		ko: {
			policy: { title: '이용약관', url: POLICY_HOST + '/kr/ko/terms' },
			privacy: { title: '개인정보처리방침', url: POLICY_HOST + '/kr/ko/privacy' }
		},
		en: {
			policy: { title: 'Terms of Use', url: POLICY_HOST + '/kr/en/terms' },
			privacy: { title: 'Privacy Policy', url: POLICY_HOST + '/kr/en/privacy' }
		}
	}[language];

	var modal = document.createElement('div');
	modal.className = 'modal';
	modal.id = 'policy-modal';
	modal.setAttribute('role', 'dialog');
	modal.setAttribute('aria-modal', 'true');
	modal.setAttribute('aria-labelledby', 'policy-modal-title');
	modal.tabIndex = -1;
	modal.hidden = true;
	modal.innerHTML =
		'<div class="policy__dialog">' +
			'<div class="policy__header">' +
				'<h4 class="policy__title" id="policy-modal-title"></h4>' +
				'<button type="button" class="policy__close" aria-label="' + (language === 'en' ? 'Close' : '닫기') + '">' +
					'<svg viewBox="0 0 1008 1008" aria-hidden="true"><path d="M1008 954 558 504 1008 54 954 0 504 450 54 0 0 54 450 504 0 954 54 1008 504 558 954 1008Z"/></svg>' +
				'</button>' +
			'</div>' +
			'<div class="policy__body"></div>' +
		'</div>';
	document.body.appendChild(modal);

	var modalTitle = modal.querySelector('.policy__title');
	var modalBody = modal.querySelector('.policy__body');
	var policyLines = {};
	var lastFocus = null;

	// 약관 페이지(워드에서 저장한 HTML)의 문단 하나를 한 줄로 바꿈. 원본 팝업처럼 글자만 줄바꿈으로 보여 주기 위함
	var toLines = function (html) {
		var doc = new DOMParser().parseFromString(html, 'text/html');
		var lines = [];
		[].forEach.call(doc.body.querySelectorAll('p'), function (paragraph) {
			[].forEach.call(paragraph.querySelectorAll('br'), function (br) {
				br.parentNode.replaceChild(doc.createTextNode('\u2028'), br);
			});
			// 워드 HTML 은 문장 중간에서도 줄을 바꿔 저장하므로 원래 줄바꿈은 공백으로, <br> 자리만 줄바꿈으로 봄
			paragraph.textContent.replace(/[\n\r\t \u00a0]+/g, ' ').split('\u2028').forEach(function (part) {
				lines.push(part.trim());
			});
		});
		return lines;
	};

	var showPolicy = function (mode) {
		modalTitle.textContent = POLICIES[mode].title;
		modalBody.textContent = '';
		policyLines[mode].forEach(function (line, index) {
			if (index > 0) modalBody.appendChild(document.createElement('br'));
			modalBody.appendChild(document.createTextNode(line));
		});

		if (modal.hidden) {
			lastFocus = document.activeElement;
			// 원본(부트스트랩)과 같이, 본문 스크롤바가 사라지면서 화면이 옆으로 밀리지 않도록 그 너비만큼 오른쪽 여백을 줌
			var scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
			if (scrollbarWidth > 0) document.body.style.paddingRight = scrollbarWidth + 'px';
			document.body.classList.add('modal-open');
			modal.hidden = false;
		}
		modal.scrollTop = 0;
		// 원본(부트스트랩)과 같이 팝업 자체에 초점을 줌. 닫기 버튼에 주면 주소로 바로 열 때 버튼에 초점 테두리가 그려짐
		modal.focus();
	};

	var openPolicy = function (mode, fromAddress) {
		// 주소에서 온 값이므로 정해진 두 이름만 받음
		if (mode !== 'policy' && mode !== 'privacy') return;
		if (policyLines[mode]) { showPolicy(mode); return; }

		document.documentElement.classList.add('is-loading-policy');
		fetch(POLICIES[mode].url)
			.then(function (response) {
				if (!response.ok) throw new Error(response.status);
				return response.text();
			})
			.then(function (html) {
				policyLines[mode] = toLines(html);
				showPolicy(mode);
			})
			.catch(function () {
				if (fromAddress) location.replace(POLICIES[mode].url);
				else location.href = POLICIES[mode].url;
			})
			.then(function () {
				document.documentElement.classList.remove('is-loading-policy');
			});
	};

	var closePolicy = function () {
		if (modal.hidden) return;
		modal.hidden = true;
		document.body.classList.remove('modal-open');
		document.body.style.paddingRight = '';
		if (lastFocus && lastFocus.focus) lastFocus.focus();
	};

	[].forEach.call(document.querySelectorAll('a[data-policy]'), function (link) {
		link.addEventListener('click', function (e) {
			// Ctrl/Command/Shift + 클릭은 새 탭·새 창으로 열도록 둠 (그 창에서는 주소의 ?mode 로 팝업이 열림)
			if (e.ctrlKey || e.metaKey || e.shiftKey) return;
			e.preventDefault();
			openPolicy(link.getAttribute('data-policy'), false);
		});
	});

	modal.querySelector('.policy__close').addEventListener('click', closePolicy);
	modal.addEventListener('click', function (e) {
		if (e.target === modal) closePolicy();
	});
	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape') closePolicy();
	});

	openPolicy(new URLSearchParams(location.search).get('mode'), true);

	/* ------------------------------------------------------------------
	 * 원본 사이트 설정과 같이 마우스 오른쪽 버튼 메뉴와 Ctrl/Command + C 를 막습니다.
	 * 필요 없으면 이 부분만 지우면 됩니다.
	 * ------------------------------------------------------------------ */
	document.addEventListener('contextmenu', function (e) {
		e.preventDefault();
	});
	document.addEventListener('keydown', function (e) {
		if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) e.preventDefault();
	});
})();
