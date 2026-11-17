const prisma = require("../src/config/prisma");

async function main() {
  const game = await prisma.game.upsert({
    where: { slug: "sample-scene" },
    update: {
      name: "The Busy Town",
      imageUrl: "/images/sample-scene.svg",
      width: 1600,
      height: 1000,
      characters: {
        deleteMany: {},
        create: [
          { name: "Red Stripes", x: 1180, y: 620, radius: 35 },
          { name: "Purple Wizard", x: 330, y: 340, radius: 35 },
          { name: "Pink Explorer", x: 820, y: 840, radius: 35 },
        ],
      },
    },
    create: {
      slug: "sample-scene",
      name: "The Busy Town",
      imageUrl: "/images/sample-scene.svg",
      width: 1600,
      height: 1000,
      characters: {
        create: [
          { name: "Red Stripes", x: 1180, y: 620, radius: 35 },
          { name: "Purple Wizard", x: 330, y: 340, radius: 35 },
          { name: "Pink Explorer", x: 820, y: 840, radius: 35 },
        ],
      },
    },
  });

  console.log("Sample game seeded successfully:");
  console.log({
    id: game.id,
    slug: game.slug,
    name: game.name,
    dimensions: `${game.width} x ${game.height}`,
  });
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
