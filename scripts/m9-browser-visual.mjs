    'return links.includes("#boutique") && links.includes("#annonces")' +
    '&& universes.length===4 && !!shop' +
    '&& shop.textContent.includes("pas encore activés")' +
    '&& fakeCommerce.length===0;})()');
  assert.equal(l1HomeReady, true,
    'L1 must expose the 2-in-1 design while keeping unfinished commerce explicit');
  assert.equal(await evaluate('(() => {' +
    'const link=[...document.querySelectorAll(".home-v2__hero-actions a")]' +
    '.find(a=>a.getAttribute("href")==="#annonces");' +
    'if(!link)return false;link.click();return true;})()'), true,
  'L1 community CTA must remain clickable');
  await waitUntil('L1 community fragment navigation',
    'location.hash==="#annonces" && !!document.querySelector("#annonces")', 40);
  await journeyScreenshot('l1-home-community-anchor-desktop');

  const exchangeSource = publicListings[0];
  await journeyOpen(
    '/annonces/' + encodeURIComponent(exchangeSource.id),
    '.listing-detail',
    'Prototype detail navigation to exchanges',
  );
  assert.equal(await evaluate('(() => {' +
    'const link=document.querySelector(\'.pm-main-nav a[href="/echanges"]\');' +
    'if(!link)return false;link.click();return true;})()'), true,
  'Prototype header must expose the dedicated Exchanges screen outside the homepage');
  await waitUntil('Prototype exchanges route opens from detail',
    'location.pathname==="/echanges" && !!document.querySelector(".pm-exchange-hero")',
    120);
  await journeyScreenshot('prototype-header-exchanges-from-detail');

  await journeyOpen('/', '.home-v2__welcome h1', 'F1 homepage after prototype route navigation');
  await waitUntil('F1 exactly six cards on the first page',
    'document.querySelectorAll(".home-v2__grid .listing-card").length===6' +
    '&&document.querySelector(".home-v2__results")?.innerText.includes("sur")', 120);

  const reportedTotal = Number(await evaluate(
    'document.querySelector(".home-v2__facts strong")?.textContent',
  ));
  assert.equal(reportedTotal, publicListings.length,
    'The hero must show the actual number of approved Catalog listings');
  const firstLinks = await evaluate('([...document.querySelectorAll(".home-v2__grid .listing-card__link")]' +
    '.map(a=>a.getAttribute("href")) )');
  assert.equal(firstLinks.length, 6);
  await journeyScreenshot('f1-catalog-six-articles-desktop');