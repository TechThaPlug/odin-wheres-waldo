const express = require("express");
const { validate: isUUID } = require("uuid");
const prisma = require("../config/prisma");

const router = express.Router();

// List available games
router.get("/", async (req, res) => {
  try {
    const games = await prisma.game.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        imageUrl: true,
        width: true,
        height: true,
      },
      orderBy: { id: "asc" },
    });

    res.json({ success: true, games });
  } catch (error) {
    console.error("Load games error:", error);
    res.status(500).json({
      success: false,
      message: "Could not load games",
    });
  }
});

// Start a game session
router.post("/:gameId/start", async (req, res) => {
  try {
    const gameId = Number(req.params.gameId);

    if (!Number.isSafeInteger(gameId) || gameId < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid game ID",
      });
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        width: true,
        height: true,
        characters: {
          select: { id: true, name: true },
        },
      },
    });

    if (!game) {
      return res.status(404).json({
        success: false,
        message: "Game not found",
      });
    }

    const session = await prisma.gameSession.create({
      data: { gameId },
    });

    res.status(201).json({
      success: true,
      sessionId: session.id,
      startedAt: session.startedAt,
      game: {
        id: game.id,
        name: game.name,
        imageUrl: game.imageUrl,
        width: game.width,
        height: game.height,
        characters: game.characters,
      },
    });
  } catch (error) {
    console.error("Start game error:", error);
    res.status(500).json({
      success: false,
      message: "Could not start game",
    });
  }
});

// Submit a character guess using image-relative coordinates (0 to 1)
router.post("/sessions/:sessionId/guess", async (req, res) => {
  const { sessionId } = req.params;
  const { characterId, x, y } = req.body;

  if (!isUUID(sessionId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid session ID",
    });
  }

  if (
    !Number.isSafeInteger(characterId) ||
    characterId < 1 ||
    typeof x !== "number" ||
    typeof y !== "number" ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    x > 1 ||
    y < 0 ||
    y > 1
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid character selection",
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lock this session so simultaneous guesses cannot finish it twice.
      const locked = await tx.$queryRaw`
        SELECT "id"
        FROM "GameSession"
        WHERE "id" = ${sessionId}
        FOR UPDATE
      `;

      if (locked.length === 0) {
        return { status: "missing" };
      }

      const session = await tx.gameSession.findUnique({
        where: { id: sessionId },
        include: {
          game: { include: { characters: true } },
          finds: true,
        },
      });

      if (!session) return { status: "missing" };

      if (session.completed) {
        return { status: "completed" };
      }

      const character = session.game.characters.find(
        (item) => item.id === characterId,
      );

      if (!character) return { status: "invalid-character" };

      const existingFind = session.finds.some(
        (find) => find.characterId === characterId,
      );

      if (existingFind) {
        return {
          status: "already-found",
          remaining: session.game.characters.length - session.finds.length,
        };
      }

      const pixelX = x * session.game.width;
      const pixelY = y * session.game.height;

      const distance = Math.hypot(pixelX - character.x, pixelY - character.y);

      if (distance > character.radius) {
        return { status: "incorrect" };
      }

      await tx.gameFind.create({
        data: {
          sessionId,
          characterId,
        },
      });

      const foundCount = session.finds.length + 1;
      const remaining = session.game.characters.length - foundCount;

      let completed = false;
      let scoreMs = null;

      if (remaining === 0) {
        const completedAt = new Date();
        scoreMs = Math.max(
          0,
          completedAt.getTime() - session.startedAt.getTime(),
        );

        await tx.gameSession.update({
          where: { id: sessionId },
          data: {
            completed: true,
            completedAt,
            scoreMs,
          },
        });

        completed = true;
      }

      return {
        status: "correct",
        character: {
          id: character.id,
          name: character.name,
          x: character.x / session.game.width,
          y: character.y / session.game.height,
        },
        foundCount,
        remaining,
        completed,
        scoreMs,
      };
    });

    if (result.status === "missing") {
      return res.status(404).json({
        success: false,
        message: "Game session not found",
      });
    }

    if (result.status === "completed") {
      return res.status(409).json({
        success: false,
        message: "This game has already been completed",
      });
    }

    if (result.status === "invalid-character") {
      return res.status(404).json({
        success: false,
        message: "Character not found",
      });
    }

    if (result.status === "incorrect") {
      return res.json({
        success: true,
        correct: false,
        message: "Not quite! Try again.",
      });
    }

    if (result.status === "already-found") {
      return res.json({
        success: true,
        correct: true,
        alreadyFound: true,
        remaining: result.remaining,
      });
    }

    res.json({
      success: true,
      correct: true,
      character: result.character,
      foundCount: result.foundCount,
      remaining: result.remaining,
      completed: result.completed,
      scoreMs: result.scoreMs,
    });
  } catch (error) {
    console.error("Guess error:", error);
    res.status(500).json({
      success: false,
      message: "Could not validate selection",
    });
  }
});

// Submit a player name once after completing the game
router.post("/sessions/:sessionId/score", async (req, res) => {
  const { sessionId } = req.params;
  const { playerName } = req.body;

  if (!isUUID(sessionId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid session ID",
    });
  }

  if (
    typeof playerName !== "string" ||
    !/^[\p{L}\p{N} _-]{1,20}$/u.test(playerName.trim())
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Name must be 1–20 letters, numbers, spaces, hyphens or underscores",
    });
  }

  try {
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Game session not found",
      });
    }

    if (!session.completed) {
      return res.status(400).json({
        success: false,
        message: "Complete the game before submitting your name",
      });
    }

    const updated = await prisma.gameSession.updateMany({
      where: {
        id: sessionId,
        completed: true,
        playerName: null,
      },
      data: {
        playerName: playerName.trim(),
      },
    });

    if (updated.count === 0) {
      return res.status(409).json({
        success: false,
        message: "A name has already been submitted",
      });
    }

    res.json({
      success: true,
      message: "Score saved successfully",
      playerName: playerName.trim(),
      scoreMs: session.scoreMs,
    });
  } catch (error) {
    console.error("Save score error:", error);
    res.status(500).json({
      success: false,
      message: "Could not save score",
    });
  }
});

// Get the top ten completed scores
router.get("/:gameId/leaderboard", async (req, res) => {
  try {
    const gameId = Number(req.params.gameId);

    if (!Number.isSafeInteger(gameId) || gameId < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid game ID",
      });
    }

    const leaderboard = await prisma.gameSession.findMany({
      where: {
        gameId,
        completed: true,
        playerName: { not: null },
        scoreMs: { not: null },
      },
      select: {
        playerName: true,
        scoreMs: true,
        completedAt: true,
      },
      orderBy: [{ scoreMs: "asc" }, { completedAt: "asc" }],
      take: 10,
    });

    res.json({ success: true, leaderboard });
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({
      success: false,
      message: "Could not load leaderboard",
    });
  }
});

module.exports = router;
