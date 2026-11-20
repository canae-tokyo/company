document.addEventListener('DOMContentLoaded', () => {

    const menuButton = document.querySelector('.nav-toggle');
    const menu = document.getElementById('main-nav');
    if (menuButton && menu) {
        document.documentElement.classList.add('nav-ready');
        const closeMenu = (restoreFocus = false) => {
            menu.classList.remove('is-open');
            menuButton.setAttribute('aria-expanded', 'false');
            menuButton.setAttribute('aria-label', 'メニューを開く');
            if (restoreFocus) menuButton.focus();
        };
        menuButton.addEventListener('click', () => {
            if (menu.classList.contains('is-open')) return closeMenu();
            menu.classList.add('is-open');
            menuButton.setAttribute('aria-expanded', 'true');
            menuButton.setAttribute('aria-label', 'メニューを閉じる');
            menu.querySelector('a')?.focus();
        });
        menu.addEventListener('click', e => {
            const link = e.target.closest('a');
            if (!link) return;
            closeMenu();
            const hash = link.getAttribute('href');
            if (hash && hash.startsWith('#') && hash.length > 1) {
                const target = document.getElementById(hash.slice(1));
                if (target) {
                    target.setAttribute('tabindex', '-1');
                    target.focus({ preventScroll: true });
                }
            }
        });
        document.addEventListener('click', e => {
            if (!menu.contains(e.target) && !menuButton.contains(e.target)) closeMenu();
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && menu.classList.contains('is-open')) closeMenu(true);
        });
        window.addEventListener('resize', () => { if (window.innerWidth > 768) closeMenu(); });
    }

    /* ---------- ALIGENTロゴ：光源角度を回してリムを回転発光 ---------- */
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.querySelectorAll('.rim-btn .rim-btn__light').forEach((light) => {
            let deg = 135;
            const tick = () => {
                deg = (deg + 1) % 360;
                light.setAttribute('azimuth', String(deg));
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        });
    }

    /* ---------- ヘッダー：スクロールに応じて背景を出現 ---------- */
    const header = document.getElementById('header');
    const toggleHeaderState = () => {
        if (!header || !document.getElementById('hero')) return;
        if (window.scrollY > 40) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    };
    toggleHeaderState();
    window.addEventListener('scroll', toggleHeaderState, { passive: true });

    /* ---------- ヒーロー背景のスムーズパララックス ---------- */
    const heroBg = document.querySelector('.hero-bg');
    if (heroBg && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        window.addEventListener('scroll', () => {
            const scroll = window.pageYOffset;
            // ズームアウトと干渉しないよう、translate3dで滑らかに下方へシフト
            if (scroll < window.innerHeight) {
                heroBg.style.transform = `translate3d(0, ${scroll * 0.25}px, 0)`;
            }
        }, { passive: true });
    }

    /* ---------- ページロード時にヒーローエリア内の要素を即座にアニメーション開始 ---------- */
    setTimeout(() => {
        document.querySelectorAll('#hero .fade-up').forEach(el => {
            el.classList.add('active');
        });
    }, 150); // 微小なラグを置いて美しく滑らかに開始

    /* ---------- スクロール連動フェードイン（IntersectionObserver） ---------- */
    const revealTargets = Array.from(document.querySelectorAll('.fade-up')).filter(
        el => !el.closest('#hero')
    );

    if ('IntersectionObserver' in window) {
        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.15,
            rootMargin: '0px 0px -60px 0px'
        });

        revealTargets.forEach(el => revealObserver.observe(el));
    } else {
        // IntersectionObserver 非対応環境では即時表示
        revealTargets.forEach(el => el.classList.add('active'));
    }

    clearTimeout(window.revealFallback);

    /* ---------- ナビゲーションの滑らかスクロール（イージング付き） ---------- */
    const getHeaderHeight = () => (header ? header.offsetHeight : 0);
    const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const smoothScrollTo = (targetY, duration = 900) => {
        const startY = window.pageYOffset;
        const diff = targetY - startY;
        let startTime = null;

        const step = (timestamp) => {
            if (startTime === null) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            window.scrollTo(0, startY + diff * easeInOutCubic(progress));
            if (progress < 1) {
                requestAnimationFrame(step);
            }
        };
        requestAnimationFrame(step);
    };

    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const hash = link.getAttribute('href');
            if (!hash || hash.length < 2) return;
            const target = document.querySelector(hash);
            if (!target) return;
            e.preventDefault();
            const targetY = target.getBoundingClientRect().top + window.pageYOffset - getHeaderHeight() + 1;
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) window.scrollTo(0, targetY);
            else smoothScrollTo(targetY);
        });
    });

    /* ---------- メールアドレスの表示組み立て（クローラー対策） ---------- */
    const emailEl = document.getElementById('contact-email');
    if (emailEl) {
        const user = 'hello';
        const domain = 'canae.tokyo';
        emailEl.textContent = `${user}@${domain}`;
    }
});
