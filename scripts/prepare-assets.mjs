import { mkdir, writeFile, readFile } from "node:fs/promises";
import sharp from "sharp";

const paintings = [
  [
    "water-lilies",
    16568,
    "File:Claude Monet - Water Lilies - 1906, Ryerson.jpg",
  ],
  [
    "cliff-walk",
    14620,
    "File:Claude Monet - Cliff Walk at Pourville - Google Art Project.jpg",
  ],
  [
    "rainy-paris",
    20684,
    "File:Gustave Caillebotte - Paris Street; Rainy Day - Google Art Project.jpg",
  ],
];
await mkdir("public/wallpapers", { recursive: true });
await mkdir("public/icons", { recursive: true });
await mkdir(".cache/artworks", { recursive: true });
const attribution = [];
for (const [name, id, commonsTitle] of paintings) {
  const response = await fetch(
    `https://api.artic.edu/api/v1/artworks/${id}?fields=id,title,artist_display,date_display,is_public_domain,image_id`,
  );
  if (!response.ok) throw new Error(`Artwork API: ${response.status}`);
  const { data, config } = await response.json();
  if (!data.is_public_domain)
    throw new Error(`${name} is not designated public domain`);
  const museumImage = `${config.iiif_url}/${data.image_id}/full/2560,/0/default.jpg`;
  const commonsResponse = await fetch(
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(commonsTitle)}&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=2560`,
  );
  const commons = Object.values((await commonsResponse.json()).query.pages)[0]
    .imageinfo[0];
  if (commons.extmetadata.LicenseShortName.value !== "Public domain")
    throw new Error("Unexpected image license");
  const source = commons.thumburl ?? commons.url;
  let original;
  try {
    original = await readFile(`.cache/artworks/${name}.jpg`);
  } catch {
    const image = await fetch(source);
    if (!image.ok) throw new Error(`Artwork image: ${image.status}`);
    original = Buffer.from(await image.arrayBuffer());
    await writeFile(`.cache/artworks/${name}.jpg`, original);
  }
  await sharp(original)
    .resize({
      width: 2560,
      height: 2560,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 88 })
    .toFile(`public/wallpapers/${name}.webp`);
  await sharp(original)
    .resize(440, 280, { fit: "cover" })
    .webp({ quality: 78 })
    .toFile(`public/wallpapers/${name}-thumb.webp`);
  attribution.push({
    ...data,
    file: `${name}.webp`,
    source,
    museumImage,
    commonsPage: commons.descriptionurl,
    license: "Public domain (PD-Art)",
    licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
    museumLicense: "https://www.artic.edu/open-access/open-access-images",
  });
  console.log(`Prepared ${name}`);
}
await writeFile(
  "public/wallpapers/sources.json",
  JSON.stringify(attribution, null, 2) + "\n",
);
const icon = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><defs><linearGradient id="b" x2="1" y2="1"><stop stop-color="#abc4b6"/><stop offset="1" stop-color="#586f75"/></linearGradient><linearGradient id="g" x2="0" y2="1"><stop stop-color="#ffffff" stop-opacity=".5"/><stop offset="1" stop-color="#ffffff" stop-opacity=".08"/></linearGradient></defs><rect x="4" y="4" width="120" height="120" rx="34" fill="url(#b)"/><rect x="19" y="19" width="90" height="90" rx="26" fill="url(#g)" stroke="#fff" stroke-opacity=".6"/><path d="M44 86V43h8l25 29V43h8v43h-8L52 57v29z" fill="#fff"/></svg>`,
);
for (const size of [16, 32, 48, 128])
  await sharp(icon)
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon-${size}.png`);
