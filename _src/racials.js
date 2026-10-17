window.RACIALS = {
 "Horde": [
  { "race": "Orc", "icon": "race_orc_male", "classes": ["Warrior", "Hunter", "Rogue", "Shaman", "Mage", "Warlock"], "abilities": [
    ["Blood Fury", "Instant, 3 min cooldown. Increases Attack Power and Spell Power by 10% for 15 sec.", "racial_orc_berserkerstrength"],
    ["Hardiness", "Duration of Stun effects on you reduced by 20%.", "inv_helmet_23"],
    ["Savage", "Increases your critical strike chance with all spells and abilities by 1%.", "inv_axe_02"],
    ["Shatter Curse", "Instant, 3 min cooldown. Instantly removes all Curses and Banes, and reduces all Magical damage taken by 5% for 8 sec.", "spell_nature_removecurse"] ] },
  { "race": "Undead", "icon": "race_scourge_male", "classes": ["Warrior", "Paladin", "Rogue", "Priest", "Mage", "Warlock"], "abilities": [
    ["Underwater Breathing", "Underwater breath lasts 300% longer than normal.", "spell_shadow_demonbreath"],
    ["Will of the Forsaken", "Instant, 2 min cooldown. Instantly removes all Charm, Fear and Sleep effects.", "spell_shadow_raisedead"],
    ["Cannibalize", "5 yd range, Instant, 2 min cooldown. When activated, regenerates 7% of total Health and 7% of total Mana every 2 sec for 10 sec. Only works on Humanoid or Undead corpses within 5 yds. Any movement, action, or damage taken while Cannibalizing will cancel the effect.", "ability_racial_cannibalize"],
    ["Touch of the Grave", "Your spells and attacks with a damage part have a chance (30% for casters, 20% for Paladins, Rogues and Warriors) to drain Health from the target, up to 5% of your maximum Health. 25 sec internal cooldown. Does not break crowd control.", "spell_shadow_fingerofdeath"] ] },
  { "race": "Tauren", "icon": "race_tauren_male", "classes": ["Warrior", "Hunter", "Shaman", "Druid"], "abilities": [
    ["War Stomp", "0.5 sec cast, 1.5 min cooldown. Stuns up to 5 enemies within 8 yds for 2 sec.", "ability_warstomp"],
    ["Endurance", "Total Health increased by 5% and critical strike bonus to damage and healing increased by 2%.", "spell_nature_unyeildingstamina"],
    ["Cultivation", "Instant. Cultivate a nearby herb, growing a duplicate you can harvest without requiring Herbalism skill. Each herb may only be cultivated once. In play it goes on a 15 min cooldown, though its tooltip shows none.", "inv_misc_flower_01"],
    ["Plainsrunning", "Gain 1% increased movement speed every 5 sec spent moving, up to a maximum of 30% increase. Taking damage or standing still will reduce this effect. In addition, you move 3% faster while mounted.", "achievement_zone_barrens_01"] ] },
  { "race": "Troll", "icon": "race_troll_male", "classes": ["Warrior", "Hunter", "Rogue", "Priest", "Shaman", "Mage", "Warlock"], "abilities": [
    ["Berserking", "Instant, 3 min cooldown. Increases your spellcasting and attack speed by 10% for 10 sec.", "racial_troll_berserk"],
    ["Regeneration", "Health regeneration rate increased by 20%. In addition, 20% of total Health regeneration will continue during combat.", "spell_nature_regenerate"],
    ["Beast Slaying", "Damage dealt versus Beasts increased by 5%.", "inv_misc_pelt_bear_ruin_02"],
    ["Rapid Regeneration", "Channeled, 3 min cooldown. Regenerate 50% of your maximum Health over 6 sec. Any movement, action, or damage taken will cancel the effect.", "ability_racial_regeneratin"] ] },
  { "race": "Skyborne (Windshaper)", "icon": "race_skyborne", "classes": ["Warrior", "Hunter", "Rogue", "Shaman", "Druid"], "abilities": [
    ["Walk on Air", "Instant, 1.5 min cooldown. Glide downward through the air for 10 sec while controlling your direction of travel.", "inv_elemental_primal_air"],
    ["Skysight", "0.5 sec cast, 2 min cooldown. Attempt to draw power from a convergence of elements and receive its blessing, increasing your movement and mounted movement speeds by 10%. Lasts 30 sec if no elemental convergence is nearby, and 15 min if one is found.", "ability_skyreach_lens_flare"],
    ["Elemental Insight", "Damage dealt versus Elementals increased by 5%.", "achievement_raidprimalist_windelemental"],
    ["Wind Blessed", "Increases your spellcasting, melee, and ranged Haste by 3%.", "inv_misc_volatileair"] ] }
 ],
 "Alliance": [
  { "race": "Human", "icon": "race_human_male", "classes": ["Warrior", "Paladin", "Hunter", "Rogue", "Priest", "Mage", "Warlock"], "abilities": [
    ["Ruthless", "Increases your critical strike chance with all spells and attacks by 2%.", "ability_rogue_eviscerate"],
    ["The Human Spirit", "Spirit increased by 5%.", "inv_enchant_shardbrilliantsmall"],
    ["Perception", "Instant, 3 min cooldown. Dramatically increases stealth detection for 20 sec.", "spell_nature_sleep"],
    ["Will to Survive", "Instant, 3 min cooldown. Instantly removes all Stun effects.", "spell_shadow_charm"] ] },
  { "race": "Dwarf", "icon": "race_dwarf_male", "classes": ["Warrior", "Paladin", "Hunter", "Rogue", "Priest", "Shaman"], "abilities": [
    ["Find Treasure", "Instant. Allows the dwarf to sense nearby treasure, making it appear on the minimap.  Lasts until canceled.", "racial_dwarf_findtreasure"],
    ["Stoneform", "Instant, 3 min cooldown. Instantly removes and grants immunity to all Bleed, Poison, and Disease effects, and reduces all Physical damage taken by 10% for 8 sec.", "spell_shadow_unholystrength"],
    ["Earth Fury", "Increases your critical strike bonus to damage and healing by 2%.", "spell_shaman_unleashweapon_earth"],
    ["Big Game Hunter", "Damage dealt versus Beasts increased by 5%.", "inv_weapon_rifle_05"] ] },
  { "race": "Night Elf", "icon": "race_nightelf_male", "classes": ["Warrior", "Hunter", "Rogue", "Priest", "Druid"], "abilities": [
    ["Shadowmeld", "Instant, 10 sec cooldown. Activate to slip into the shadows, reducing the chance for enemies to detect your presence. Lasts until cancelled or upon moving. Using this ability in combat discourages enemies from attacking you, but increases the cooldown to 2 min.", "ability_ambush"],
    ["Quickness", "Dodge chance increased by 1% and movement speed increased by 2%. Night Elf Rogues and Druids are harder to detect in Stealth as if they were 1 level higher.", "ability_racial_shadowmeld"],
    ["Wisp Spirit", "Transform into a wisp upon death, increasing movement speed by 75%.", "spell_nature_wispsplode"],
    ["Elune's Light", "Instant, 3 min cooldown. Increases your critical strike chance with all spells and attacks by 10% for 15 sec.", "spell_nature_moonglow"] ] },
  { "race": "Gnome", "icon": "race_gnome_male", "classes": ["Warrior", "Rogue", "Priest", "Mage", "Warlock"], "abilities": [
    ["Escape Artist", "Instant, 2 min cooldown. Instantly escape the effects of any movement impairing effect and gain immunity to those effects for 3 sec.", "ability_rogue_trip"],
    ["Expansive Mind", "Maximum Mana, Rage or Energy increased by 5%, whichever your class uses.", "inv_enchant_essenceeternallarge"],
    ["Engineering Specialization", "Your gnomish ingenuity reduces the rate of engineering devices failing or backfiring when you use them by 20%.", "inv_misc_gear_01"],
    ["Eureka!", "Instant, 2 min cooldown. For 8 sec, your non-periodic damaging abilities cost 10% less (Mana, Rage or Energy) and deal 10% more damage. For Priests, your non-periodic damaging or healing abilities cost 10% less Mana and do 10% more damage or healing. Periodic effects get nothing from it; a channeled spell is not periodic. The Mage's own tooltip is the one that leaves out non-periodic.", "inv_gnometoy"] ] },
  { "race": "Skyborne (High Order)", "icon": "race_skyborne", "classes": ["Warrior", "Hunter", "Rogue", "Mage", "Druid"], "abilities": [
    ["Walk on Air", "Instant, 1.5 min cooldown. Glide downward through the air for 10 sec while controlling your direction of travel.", "inv_elemental_primal_air"],
    ["Read Leyline", "2 sec cast, 2 min cooldown. Attempt to tap into the power of a nearby leyline, increasing your Health and Mana regeneration by 100%. Lasts 30 sec if no leyline is nearby, and 15 min if one is found.", "ability_mage_incantersabsorbtion"],
    ["Elemental Insight", "Damage dealt versus Elementals increased by 5%.", "achievement_raidprimalist_windelemental"],
    ["Wind Blessed", "Increases your spellcasting, melee, and ranged Haste by 3%.", "inv_misc_volatileair"] ] }
 ]
};
// Class-specific racial spells seen in the BlizzCon 2026 demo. Partial: only what has been observed or reported so far.
window.CLASS_RACIALS = {
 "Priest": {
  "note": "Spell text from the beta client. Which race gets which spell was first seen in the demo.",
  "races": {
   "Human": [
    [
     "Divine Grace",
     "40 yd range, Instant, 10 min cooldown. Instantly heals a friendly target below 50% Health for 1,285 to 1,513 and removes Weakened Soul from that target. Cannot be cast on self.",
     "ability_priest_savinggrace"
    ],
    [
     "Feedback",
     "230 Mana, Instant, 3 min cooldown. The priest becomes surrounded with anti-magic energy.  Any successful spell cast against the priest will burn 105 of the attacker's Mana, causing 1 Shadow damage for each point of Mana burned.  Lasts 15 sec.",
     "spell_shadow_ritualofsacrifice"
    ]
   ],
   "Dwarf": [
    [
     "Chastise",
     "225 Mana, 20 yd range, Instant, 2 min cooldown. Chastise the target, causing 272 to 306 Holy damage and Immobilizing them for up to 2 sec. Only works against Humanoids. This spell causes very low threat.",
     "spell_holy_chastise"
    ],
    [
     "Desperate Prayer",
     "Instant, 10 min cooldown. Instantly heals the caster for 1,285 to 1,513.",
     "spell_holy_restoration"
    ]
   ],
   "Night Elf": [
    [
     "Elune's Grace",
     "3% of base mana, Instant, 5 min cooldown. Reduces the chance you'll be hit by melee and ranged attacks by 50% for 15 sec or until you are missed 3 times.",
     "spell_holy_elunesgrace"
    ],
    [
     "Starshards",
     "350 Mana, 30 yd range, Channeled, 30 sec cooldown. Rains starshards down on the enemy target's head, causing 1,800 Arcane damage over 6 sec.",
     "spell_arcane_starfire"
    ]
   ],
   "Gnome": [
    [
     "Confounding Flash",
     "3% of base mana, 0.5 sec cast, 2 min cooldown. Confuses up to 5 enemies within 8 yds for 3 sec. Any damage taken will break the effect.",
     "ability_paladin_blindinglight2"
    ],
    [
     "Contingency Plan",
     "30 yd range, Instant, 10 min cooldown. Place a Holy ward on an ally for 30 sec. The next time this ally takes damage dropping their Health below 35%, they will gain a shield absorbing 926 damage and begin healing for 670 Health over 15 sec. A target may be affected by only one Contingency Plan.",
     "ability_priest_soulwarding"
    ]
   ],
   "Undead": [
    [
     "Dark Sacrifice",
     "Instant, 10 min cooldown. Cannibalize 1,600 of your own Health over 15 sec to gain 1,600 Mana, plus your Spirit.",
     "spell_holy_powerinfusion_shadow"
    ],
    [
     "Touch of Weakness",
     "195 Mana, Instant. The next melee attack on the caster will cause 56 Shadow damage and reduce the attacker's melee attack power by the attacker by 204 for 2 min.",
     "spell_shadow_deadofnight"
    ]
   ],
   "Troll": [
    [
     "Hex of Weakness",
     "240 Mana, 30 yd range, Instant. Weakens the target enemy, reducing melee attack power by 204 and reducing the effectiveness of any healing by 20%. Lasts 2 min",
     "spell_shadow_fingerofdeath"
    ],
    [
     "Shadowguard",
     "250 Mana, Instant. The caster is surrounded by shadows. When a spell, melee or ranged attack hits the caster, the attacker will be struck for 96 Shadow damage. Attackers can only be damaged once every few seconds. This damage causes no threat. 3 charges. Lasts 10 min.",
     "spell_nature_lightningshield"
    ]
   ]
  }
 }
};
// Class abilities that are new or changed in Forever. Short and plain; the spellbook tooltips carry the exact text.
window.CLASS_ABILITIES = {
 "Paladin": [["Judgement", "Changed: it no longer eats your seal. 10 yd range, 10 sec cooldown. Judging Seal of Fury taunts for 4 sec.", "spell_holy_righteousfury"], ["Seal of Fury", "The tank seal: every hit adds Holy damage, and with a shield up an absorb worth half of it. Level 10, ranks to 58.", "spell_holy_retributionaura"], ["Holy Strike", "Baseline Ret strike, 10 sec cooldown: weapon damage plus Holy. Level 6, ranks to 60. Several talents build on it.", "classicon_paladin"], ["Blessing of Kings and Consecration", "Both trainable now, not talents. Consecration at level 20.", "spell_magic_magearmor"]],
 "Priest": [["Penance", "New Discipline channel: Holy damage or healing, instantly and every 1 sec for 2 sec, 12 sec cooldown. Rank 1 from the talent at 30, ranks 2 to 4 at 40, 50 and 60.", "spell_holy_penance"], ["Binding Heal", "New 1.5 sec cast: heals a friend and you at once, low threat. Rank 1 from the talent at 25, ranks 2 to 6 from 32 to 56.", "spell_holy_blindingheal"], ["Prayer of Mending", "New: a heal that goes off when the target is hit or healed, then jumps to a party or raid member within 20 yd, up to 5 times. Instant, 10 sec cooldown. Rank 1 from the talent at 40, ranks at 50 and 60.", "spell_holy_prayerofmendingtga"], ["Shadow Word: Death", "New Shadow nuke, 18 sec cooldown, ranks at 32, 40, 48 and 56. If the target survives you take 10% of your max health. Early Demise adds 15 or 30% crit on targets at or below 20% health.", "spell_shadow_demonicfortitude"]],
 "Hunter": [["Aimed Shot", "Trainable now, not a talent, and quicker: 2 sec cast (Classic 3), 6 sec cooldown shared with Multi-Shot. Level 20, ranks to 60. A reader caught the cast time on Xaryu's stream.", "inv_spear_07"], ["Call Owl", "Call Pet is named after your pet. The demo Hunter's read Call Owl.", "ability_hunter_beastcall"], ["Aspect of the Beast", "Changed: rank 1 makes you untrackable and adds 50 melee attack power (Classic: untrackable only). Spotted by a reader on Xaryu's stream.", "ability_mount_pinktiger"]],
 "Mage": [["Comprehend Scroll", "New little ability: decipher an untranslated scroll. Level 6.", "8188276"], ["Arcane Blast", "New. Rank 1 from the Arcane talent, ranks 2 to 5 at 30, 40, 50 and 60.", "spell_arcane_blast"], ["Ice Lance", "New. Rank 1 from the Frost talent, five more ranks from 28 to 56.", "spell_frost_frostblast"], ["Frostfire Bolt", "New at 40, ranks at 50 and 60: a bolt that is both Fire and Frost. Missile Barrage, Improved Fireball and Heating Up name it.", "ability_mage_frostfirebolt"], ["Teleport: Dalaran", "New at 50. The files give it to Alliance races only and the class trainer does not sell it; where it is learned is not known yet.", "spell_arcane_teleporthalloftheguardian"]],
 "Warlock": [["Bane of Agony", "Curse of Agony, renamed. Bane of Doom the same. Banes and Curses are separate now, so you can run one of each.", "spell_shadow_curseofsargeras"]],
 "Warrior": [["Rage", "From damage taken and your swings. Slower weapons give more Rage a swing, so it comes in at a steady rate. Out of combat you lose 1.25 Rage a second. From the Rage tooltip and Blizzard's Class Highlights video (0:23).", "ability_warrior_endlessrage"], ["Victory Rush", "Baseline, Arms tab. Instant, 30 sec cooldown: a melee hit that heals 10% of your max health, within 20 sec of a non-trivial kill. Read off Soda's stream via a reader.", "ability_warrior_devastate"], ["Tactical Mastery", "A passive in the Arms tab now, not a talent: keep up to 10 Rage when you change stances, and Improved Tactical Mastery adds up to 15 more. From Soda's Warrior video via a reader.", "spell_nature_enchantarmor"], ["Intercept", "Unchanged from Classic: level 30 in the Fury tab, ranks at 42 and 52. Improved Intercept stays in the Fury tree.", "ability_rogue_sprint"], ["Slam", "A new rank 1 at 20; Classic's four ranks follow at 30, 38, 46 and 54, one rank number higher. 18 sec cooldown now (Classic had none).", "ability_warrior_decisivestrike"], ["Thunder Clap", "Works in Battle or Defensive Stance. Rank 4 slows attacks 20% for 22 sec on up to 4 targets (Classic 10%). Xaryu's stream via a reader; the Classic number from the files.", "spell_nature_thunderclap"], ["Bloodrage", "Still there, Protection tab: 20% of your base health for 10 Rage, plus 10 more over 10 sec.", "ability_racial_bloodrage"], ["Shield Wall", "Changed: 15 min cooldown, 60% less damage for 12 sec (Classic 30 min, 75% for 10 sec). No shared cooldown with Retaliation and Recklessness any more: each has its own timer, and Blizzard's Class Highlights video (1:14) says so. Two readers flagged it first.", "ability_warrior_shieldwall"], ["Shield Block", "Changed: 2 charges and 7 sec (Classic 1 block for 5 sec). Still 10 Rage, 5 sec cooldown, Defensive Stance. From a Tyler1 spellbook screenshot a reader sent in.", "ability_defend"]],
 "Rogue": [["Energy", "Comes back 1 point every 0.1 sec, 10 a second: Classic's rate with no tick to wait for. From the Energy tooltip and Blizzard's Class Highlights video (3:41).", "spell_shadow_fumble"], ["Mutilate", "New talent, Assassination row 5: both weapons at 75% each, 20% more on poisoned targets, 2 combo points. Remorseless Attacks, Lethality, Cold Blood, Puncturing Wounds and Opportunity name it.", "ability_rogue_deadlybrew"], ["Venom", "New finisher at the bottom of Assassination. Your poisons do 30% more and apply 10% more often, longer per combo point.", "inv_sword_31"], ["Thousand Cuts", "New Subtlety capstone. Each Rupture tick takes 3 Energy off your next Hemorrhage or Backstab, stacking to 5.", "ability_rogue_rupture"], ["Axes", "Rogues can use one-handed axes now. The Hack and Slash talent lists Axe/Sword as a weapon group.", "inv_axe_09"]],
 "Druid": [["Omen of Clarity and Nature's Grasp", "Both trainable now, not talents, in the Balance tab: Nature's Grasp at 10, Omen of Clarity (a passive now) at 20.", "spell_nature_crystalball"], ["Revive", "New out-of-combat resurrection, 10 sec cast. Rebirth keeps its 30 min cooldown.", "ability_druid_lunarguidance"], ["Lacerate", "Bear bleed from later expansions, baseline here; Shredding Attacks cuts its Rage cost. Level 42, ranks at 50 and 58. Thanks to a reader.", "ability_druid_lacerate"], ["Cure Poison", "Still here: level 14 from the quest Power over Poison, as in Classic. Since build 70170 High Order Skyborne can take that quest too (Blizzard's notes).", "spell_nature_nullifypoison"]],
 "Shaman": [["Lightning Bolt", "Ranks 4 to 10 cast in 2.5 sec, half a second under Classic's 3. Ranks 1 to 3 keep 1.5, 2 and 2.5 sec.", "spell_nature_lightning"], ["Chain Lightning", "Also half a second faster: rank 1 is a 2 sec cast, 6 sec cooldown, 3 targets, each jump 30% weaker. Max Elemental Alacrity brings Lightning Bolt to the same 2 sec.", "spell_nature_chainlightning"], ["Totemic Projection", "New: pick a spot up to 30 yd away and your totems move there. Seen on Guzu's stream. Totemic Recall is in too.", "ability_shaman_totemrelocation"], ["Totems last 5 min", "Lasting totems last 5 min now (most were 2 min in Classic; Healing Stream and Mana Spring 1 min). Searing (30 to 55 sec by rank), Magma (20), Stoneclaw (15), Earthbind and Grounding (45) and Mana Tide (12) keep their short timers. Blizzard's Class Highlights video (3:00) says five minutes.", "spell_nature_strengthofearthtotem02"], ["Call of the Elements, Ancestors and Spirits", "New: each drops up to four totems from its own Totem Bar set in one 3 sec cast. Elements at 20, Ancestors at 30, Spirits at 40.", "spell_shaman_dropall_01"], ["Ghost Wolf", "Still a 3 sec cast, but Improved Ghost Wolf takes 1 sec off at rank 1 and all 3 at rank 2, and lets it work indoors: instant at 2/2, as Guzu's tooltip showed.", "spell_nature_spiritwolf"], ["Fire Nova", "A spell now, not a totem: 30 yd range, instant, 10 sec cooldown, blasts everything within 10 yd of your Fire totem (rank 3 at 32: 126 to 142; rank 5 at 52: 232 to 258). Trial by Fire trims 2 or 4 sec off the cooldown.", "spell_fire_sealoffire"]]
};
// data revised 2026-09-13: Night Elf priest spells and Warrior Victory Rush confirmed on stream footage
