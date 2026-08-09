// WaveKey landing page — OS detection + dynamic release fetching.
// Never hardcode a version number here: this always pulls the latest
// GitHub Release so the page never goes stale after a new tag ships.

const REPO = 'odqin/WaveKey';

function detectOS() {
  const platform = navigator.userAgent || navigator.platform || '';
  if (/Windows/i.test(platform)) return 'windows';
  if (/Linux/i.test(platform) && !/Android/i.test(platform)) return 'linux';
  return 'other';
}

function findAsset(assets, extension) {
  return assets.find(a => a.name.toLowerCase().endsWith(extension.toLowerCase()));
}

async function init() {
  const os = detectOS();
  const primaryBtn = document.getElementById('primary-download');
  const primaryIcon = document.getElementById('primary-download-icon');
  const primaryLabel = document.getElementById('primary-download-label');
  const secondaryLinks = document.getElementById('secondary-links');
  const navVersion = document.getElementById('nav-version');

  const releasesPageUrl = `https://github.com/${REPO}/releases`;

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
    const release = await res.json();
    const assets = release.assets || [];

    navVersion.textContent = release.tag_name || '';

    const msi = findAsset(assets, '.msi');
    const deb = findAsset(assets, '.deb');
    const appImage = findAsset(assets, '.appimage');

    // Set the primary button based on detected OS
    if (os === 'windows' && msi) {
      primaryIcon.className = 'ti ti-brand-windows';
      primaryLabel.textContent = 'Download for Windows';
      primaryBtn.href = msi.browser_download_url;
    } else if (os === 'linux' && deb) {
      primaryIcon.className = 'ti ti-brand-debian';
      primaryLabel.textContent = 'Download for Linux (.deb)';
      primaryBtn.href = deb.browser_download_url;
    } else {
      primaryIcon.className = 'ti ti-download';
      primaryLabel.textContent = 'View Releases';
      primaryBtn.href = releasesPageUrl;
    }

    // Always show all secondary links, de-emphasizing whichever matches the primary
    const links = [];
    if (msi && os !== 'windows') {
      links.push(`<a href="${msi.browser_download_url}">Windows (.msi)</a>`);
    } else if (msi) {
      links.push(`<span>Windows (.msi)</span>`);
    }
    if (deb && os !== 'linux') {
      links.push(`<a href="${deb.browser_download_url}">Linux (.deb)</a>`);
    } else if (deb) {
      links.push(`<span>Linux (.deb)</span>`);
    }
    if (appImage) {
      links.push(`<a href="${appImage.browser_download_url}">Linux (AppImage)</a>`);
    }
    secondaryLinks.innerHTML = links.join(' &middot; ');

  } catch (err) {
    // Network failure, rate limit, or no releases yet — fall back gracefully
    console.error('Failed to fetch latest release:', err);
    primaryIcon.className = 'ti ti-download';
    primaryLabel.textContent = 'View Releases';
    primaryBtn.href = releasesPageUrl;
    secondaryLinks.innerHTML = `<a href="${releasesPageUrl}">See all releases on GitHub</a>`;
    navVersion.textContent = '';
  }
}

init();