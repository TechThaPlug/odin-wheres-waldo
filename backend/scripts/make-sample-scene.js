const fs = require("fs");
const path = require("path");

const WIDTH = 1600;
const HEIGHT = 1000;

const characters = [
  { name: "Red Stripes", x: 1180, y: 620, color: "#dc2626" },
  { name: "Purple Wizard", x: 330, y: 340, color: "#7c3aed" },
  { name: "Pink Explorer", x: 820, y: 840, color: "#ec4899" },
];

const colors = [
  "#fca5a5",
  "#93c5fd",
  "#86efac",
  "#fde68a",
  "#c4b5fd",
  "#fdba74",
];

let shapes = "";

for (let i = 0; i < 240; i++) {
  const x = (i * 137) % WIDTH;
  const y = (i * 83) % HEIGHT;
  const color = colors[i % colors.length];

  shapes += `
    <g transform="translate(${x} ${y})">
      <circle r="13" fill="${color}" stroke="#334155" stroke-width="2"/>
      <path d="M-15 17 Q0 5 15 17 L20 55 H-20 Z"
        fill="${color}" stroke="#334155" stroke-width="2"/>
      <circle cx="-5" cy="-2" r="2" fill="#1e293b"/>
      <circle cx="5" cy="-2" r="2" fill="#1e293b"/>
    </g>`;
}

for (const character of characters) {
  shapes += `
    <g transform="translate(${character.x} ${character.y})">
      <circle r="25" fill="${character.color}" stroke="#111827" stroke-width="3"/>
      <path d="M-24 -8 H24 M-24 0 H24 M-24 8 H24"
        stroke="white" stroke-width="5"/>
      <circle cx="-8" cy="-3" r="3" fill="#111827"/>
      <circle cx="8" cy="-3" r="3" fill="#111827"/>
    </g>`;
}

const svg = `
<svg xmlns="http://www.w3.org/2000/svg"
     width="${WIDTH}" height="${HEIGHT}"
     viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="100%" height="100%" fill="#dbeafe"/>
  <path d="M0 250 H1600 M0 500 H1600 M0 750 H1600"
        stroke="#bfdbfe" stroke-width="5"/>
  ${shapes}
</svg>`;

const output = path.join(__dirname, "../../frontend/images/sample-scene.svg");

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, svg.trim(), "utf8");

console.log(`Sample scene created: ${output}`);
console.log(`Dimensions: ${WIDTH} x ${HEIGHT}`);
console.log("Character positions:", characters);
