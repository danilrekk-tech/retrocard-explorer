/**
 * Топ самых известных и любимых игр по системам (курируемый список).
 * Игры из списка помечаются короной. Порядок = место в топе.
 */
import type { SystemId } from "@/lib/agent/types";

import { normKey, similarity } from "./normalize";

export const TOP_GAMES: Partial<Record<SystemId, string[]>> = {
  nes: ["Super Mario Bros. 3", "The Legend of Zelda", "Super Mario Bros.", "Mega Man 2", "Metroid", "Castlevania", "Contra", "Punch-Out!!", "Kirby's Adventure", "Duck Tales", "Battletoads", "Ninja Gaiden", "Tetris", "Chip 'n Dale Rescue Rangers", "Final Fantasy", "Castlevania III", "Mega Man 3", "Bomberman", "Double Dragon II", "Teenage Mutant Ninja Turtles II"],
  snes: ["Super Mario World", "The Legend of Zelda: A Link to the Past", "Super Metroid", "Chrono Trigger", "Final Fantasy VI", "Donkey Kong Country", "Donkey Kong Country 2", "Super Mario Kart", "Street Fighter II Turbo", "Earthbound", "Secret of Mana", "Yoshi's Island", "Super Mario RPG", "Mega Man X", "Super Castlevania IV", "Mortal Kombat II", "Contra III", "Kirby Super Star", "F-Zero", "Teenage Mutant Ninja Turtles IV"],
  gb: ["Tetris", "Pokemon Red", "Pokemon Blue", "Pokemon Yellow", "The Legend of Zelda: Link's Awakening", "Super Mario Land 2", "Super Mario Land", "Kirby's Dream Land", "Metroid II", "Donkey Kong", "Wario Land", "Dr. Mario"],
  gbc: ["Pokemon Gold", "Pokemon Silver", "Pokemon Crystal", "The Legend of Zelda: Link's Awakening DX", "The Legend of Zelda: Oracle of Ages", "The Legend of Zelda: Oracle of Seasons", "Super Mario Bros. Deluxe", "Wario Land 3", "Pokemon Pinball", "Dragon Warrior Monsters", "Shantae", "Metal Gear Solid"],
  gba: ["Pokemon Emerald", "Pokemon FireRed", "Pokemon Ruby", "Pokemon Sapphire", "Metroid Fusion", "Metroid Zero Mission", "The Legend of Zelda: The Minish Cap", "Advance Wars", "Fire Emblem", "Castlevania: Aria of Sorrow", "Mario Kart: Super Circuit", "Golden Sun", "Mario & Luigi: Superstar Saga", "Final Fantasy Tactics Advance", "WarioWare", "Kirby & The Amazing Mirror", "Super Mario Advance 4"],
  megadrive: ["Sonic the Hedgehog 2", "Sonic the Hedgehog", "Sonic 3 & Knuckles", "Streets of Rage 2", "Gunstar Heroes", "Mortal Kombat II", "Aladdin", "Earthworm Jim", "Phantasy Star IV", "Shinobi III", "Comix Zone", "Contra: Hard Corps", "Golden Axe", "Ecco the Dolphin", "Rocket Knight Adventures", "Castlevania: Bloodlines", "Vectorman", "The Lion King", "Mortal Kombat 3", "Desert Strike"],
  n64: ["Super Mario 64", "The Legend of Zelda: Ocarina of Time", "GoldenEye 007", "Mario Kart 64", "The Legend of Zelda: Majora's Mask", "Super Smash Bros.", "Banjo-Kazooie", "Perfect Dark", "Star Fox 64", "Paper Mario", "Donkey Kong 64", "Mario Party 2", "Conker's Bad Fur Day", "F-Zero X", "Diddy Kong Racing", "Pokemon Snap", "Wave Race 64"],
  psx: ["Final Fantasy VII", "Metal Gear Solid", "Castlevania: Symphony of the Night", "Crash Bandicoot", "Resident Evil 2", "Silent Hill", "Gran Turismo 2", "Tekken 3", "Spyro the Dragon", "Final Fantasy IX", "Final Fantasy VIII", "Tony Hawk's Pro Skater 2", "Chrono Cross", "Crash Team Racing", "Crash Bandicoot: Warped", "Driver", "Medal of Honor", "Syphon Filter", "Vagrant Story", "Oddworld: Abe's Oddysee", "Ape Escape", "Twisted Metal 2", "Resident Evil 3", "Tomb Raider"],
  psp: ["God of War: Chains of Olympus", "God of War: Ghost of Sparta", "Grand Theft Auto: Vice City Stories", "Grand Theft Auto: Liberty City Stories", "Crisis Core: Final Fantasy VII", "Monster Hunter Freedom Unite", "Metal Gear Solid: Peace Walker", "Persona 3 Portable", "Tekken: Dark Resurrection", "LocoRoco", "Patapon", "Daxter", "Burnout Legends", "Lumines", "Need for Speed: Most Wanted", "Ratchet & Clank: Size Matters"],
  arcade: ["Street Fighter II", "Metal Slug", "Metal Slug X", "Metal Slug 3", "The King of Fighters '98", "Pac-Man", "Galaga", "Donkey Kong", "Mortal Kombat", "Teenage Mutant Ninja Turtles", "The Simpsons", "X-Men", "Cadillacs and Dinosaurs", "Final Fight", "Marvel vs. Capcom", "Puzzle Bobble", "1942", "Ms. Pac-Man", "Street Fighter Alpha 3", "Samurai Shodown II"],
  neogeo: ["Metal Slug", "Metal Slug X", "Metal Slug 3", "The King of Fighters '98", "The King of Fighters 2002", "Garou: Mark of the Wolves", "Samurai Shodown II", "Fatal Fury Special", "The Last Blade 2", "Blazing Star", "Puzzle Bobble"],
  mastersystem: ["Alex Kidd in Miracle World", "Sonic the Hedgehog", "Phantasy Star", "Wonder Boy III: The Dragon's Trap", "Castle of Illusion", "Shinobi", "R-Type", "Golden Axe Warrior"],
  gamegear: ["Sonic the Hedgehog", "Sonic Triple Trouble", "Shining Force: The Sword of Hajya", "Columns", "The GG Shinobi", "Sonic Chaos", "Streets of Rage 2"],
  pcengine: ["Bonk's Adventure", "Ys Book I & II", "Castlevania: Rondo of Blood", "Blazing Lazers", "R-Type", "Bomberman '93", "Splatterhouse", "Neutopia", "Soldier Blade"],
  dos: ["Doom", "Doom II", "Prince of Persia", "Wolfenstein 3D", "Heroes of Might and Magic II", "Warcraft II", "Duke Nukem 3D", "Quake", "Commander Keen", "The Secret of Monkey Island", "Civilization", "Dune II", "X-COM: UFO Defense", "Lemmings", "Fallout", "SimCity 2000"],
  nds: ["New Super Mario Bros.", "Mario Kart DS", "Pokemon HeartGold", "Pokemon SoulSilver", "Pokemon Platinum", "Pokemon Black", "The World Ends with You", "Castlevania: Dawn of Sorrow", "Professor Layton and the Curious Village", "Phoenix Wright: Ace Attorney", "Chrono Trigger", "Super Mario 64 DS", "The Legend of Zelda: Phantom Hourglass", "Advance Wars: Dual Strike", "Kirby Super Star Ultra"],
  segacd: ["Sonic CD", "Lunar: The Silver Star", "Snatcher", "Night Trap", "Final Fight CD", "Popful Mail"],
  sega32x: ["Knuckles' Chaotix", "Virtua Racing Deluxe", "Doom", "Star Wars Arcade", "Kolibri"],
  saturn: ["Nights into Dreams", "Panzer Dragoon Saga", "Guardian Heroes", "Radiant Silvergun", "Sega Rally Championship", "Virtua Fighter 2", "Dragon Force", "Saturn Bomberman", "Burning Rangers", "Shining Force III"],
  dreamcast: ["Sonic Adventure", "Sonic Adventure 2", "Shenmue", "Jet Set Radio", "Soulcalibur", "Crazy Taxi", "Skies of Arcadia", "Marvel vs. Capcom 2", "Power Stone 2", "Phantasy Star Online", "Resident Evil Code: Veronica", "Rez"],
  atari2600: ["Pitfall!", "Adventure", "River Raid", "Space Invaders", "Yars' Revenge", "Missile Command", "Asteroids", "Pac-Man", "Frogger", "Combat", "Breakout", "Enduro"],
  atari7800: ["Ms. Pac-Man", "Food Fight", "Asteroids", "Galaga", "Robotron: 2084", "Ninja Golf"],
  lynx: ["California Games", "Chip's Challenge", "Todd's Adventures in Slime World", "Blue Lightning", "Klax"],
  virtualboy: ["Mario's Tennis", "Wario Land", "Red Alarm", "Teleroboxer", "Galactic Pinball"],
  ngp: ["Metal Slug 1st Mission", "Neo Turf Masters"],
  ngpc: ["SNK vs. Capcom: The Match of the Millennium", "Metal Slug 2nd Mission", "Sonic the Hedgehog Pocket Adventure", "The King of Fighters: Battle de Paradise", "Biomotor Unitron"],
  wonderswan: ["Gunpey", "Klonoa: Moonlight Museum", "Final Fantasy"],
  wonderswancolor: ["Final Fantasy IV", "Final Fantasy II", "Riviera: The Promised Land", "Digimon Tamers"],
  msx: ["Metal Gear", "Metal Gear 2: Solid Snake", "Vampire Killer", "Nemesis", "The Maze of Galious", "Knightmare", "Space Manbow", "Aleste"],
  c64: ["Impossible Mission", "Boulder Dash", "Maniac Mansion", "The Last Ninja", "Turrican", "Elite", "Bubble Bobble", "Wizball", "Paradroid", "Giana Sisters"],
  amiga: ["Lemmings", "Turrican II", "Speedball 2", "The Secret of Monkey Island", "Sensible Soccer", "Another World", "Shadow of the Beast", "Cannon Fodder", "Worms", "Flashback"],
  colecovision: ["Donkey Kong", "Zaxxon", "Venture", "Lady Bug", "Mr. Do!"],
  intellivision: ["Astrosmash", "Burgertime", "Utopia", "Night Stalker", "Advanced Dungeons & Dragons"],
  pokemini: ["Pokemon Party Mini", "Pokemon Pinball Mini", "Pokemon Puzzle Collection"],
  vectrex: ["Mine Storm", "Scramble", "Star Trek: The Motion Picture", "Berzerk"],
  threedo: ["Gex", "Road Rash", "Star Control II", "The Need for Speed", "Return Fire", "Wing Commander III"],
  pcenginecd: ["Castlevania: Rondo of Blood", "Ys Book I & II", "Gate of Thunder", "Lords of Thunder", "Dracula X"],
};
TOP_GAMES.genesis = TOP_GAMES.megadrive;

export interface TopInfo {
  rank: number;
  title: string;
}

const cache = new Map<string, TopInfo | null>();

/** Место игры в топе своей системы (или null). */
export function topRank(systemId: SystemId, title: string): TopInfo | null {
  const key = `${systemId}::${normKey(title)}`;
  if (cache.has(key)) return cache.get(key)!;
  const list = TOP_GAMES[systemId] ?? [];
  let best: TopInfo | null = null;
  let bestScore = 0;
  list.forEach((t, i) => {
    const s = similarity(title, t);
    if (s > bestScore) {
      bestScore = s;
      best = { rank: i + 1, title: t };
    }
  });
  const res = bestScore >= 0.8 ? best : null;
  cache.set(key, res);
  return res;
}
