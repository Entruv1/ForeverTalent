window.RACIALS = {
 "Horde": [
  { "race": "Orc", "icon": "race_orc_male", "classes": ["Warrior", "Hunter", "Rogue", "Shaman", "Mage", "Warlock"], "abilities": [
    ["Blood Fury", "Instant, 2 min cooldown. Increases Attack Power and Spell Power by 10% for 15 sec.", "racial_orc_berserkerstrength"],
    ["Hardiness", "Duration of Stun effects on you reduced by 20%.", "inv_helmet_23"],
    ["Axe Specialization", "Increases your critical strike chance with all spells and abilities by 1% while you have an axe or a two-handed axe equipped.", "inv_axe_02"],
    ["Shatter Curse", "Instant, 3 min cooldown. Instantly removes and grants immunity to all Curses and Banes, and reduces all Magical damage taken by 15% for 8 sec.", "spell_nature_removecurse"] ] },
  { "race": "Undead", "icon": "race_scourge_male", "classes": ["Warrior", "Paladin", "Rogue", "Priest", "Mage", "Warlock"], "abilities": [
    ["Underwater Breathing", "Underwater breath lasts 300% longer than normal.", "spell_shadow_demonbreath"],
    ["Will of the Forsaken", "Instant, 2 min cooldown. Instantly removes all Charm, Fear and Sleep effects.", "spell_shadow_raisedead"],
    ["Cannibalize", "5 yd range, Instant, 2 min cooldown. When activated, regenerates 7% of total Health and 7% of total Mana every 2 sec for 10 sec. Only works on Humanoid or Undead corpses within 5 yds. Any movement, action, or damage taken while Cannibalizing will cancel the effect.", "ability_racial_cannibalize"],
    ["Touch of the Grave", "Your spells and attacks with a damage part have a chance (10% for casters, 5% for melee) to drain Health from the target, up to 5% of your maximum Health. 1 sec internal cooldown. Does not break crowd control.", "spell_shadow_fingerofdeath"] ] },
  { "race": "Tauren", "icon": "race_tauren_male", "classes": ["Warrior", "Hunter", "Shaman", "Druid"], "abilities": [
    ["War Stomp", "0.5 sec cast, 2 min cooldown. Stuns up to 5 enemies within 8 yds for 2 sec.", "ability_warstomp"],
    ["Endurance", "Total Health increased by 5% and chance to hit increased by 1%.", "spell_nature_unyeildingstamina"],
    ["Cultivation", "Instant, 1 hour cooldown. Cultivate a nearby herb, growing a duplicate you can harvest without requiring Herbalism skill. Each herb may only be cultivated once.", "inv_misc_flower_01"],
    ["Plainsrunning", "Gain 1% increased movement speed every 5 sec spent moving, up to a maximum of 30% increase. Taking damage or standing still will reduce this effect.", "achievement_zone_barrens_01"] ] },
  { "race": "Troll", "icon": "race_troll_male", "classes": ["Warrior", "Hunter", "Rogue", "Priest", "Shaman", "Mage", "Warlock"], "abilities": [
    ["Berserking", "Instant, 3 min cooldown. Increases your spellcasting and attack speed by 10% for 10 sec.", "racial_troll_berserk"],
    ["Regeneration", "Health regeneration rate increased by 10%. In addition, 10% of total Health regeneration will continue during combat.", "spell_nature_regenerate"],
    ["Beast Slaying", "Damage dealt versus Beasts increased by 5%.", "inv_misc_pelt_bear_ruin_02"],
    ["Rapid Regeneration", "Channeled, 3 min cooldown. Regenerate 50% of your maximum Health over 6 sec. Any movement, action, or damage taken will cancel the effect.", "ability_racial_regeneratin"] ] },
  { "race": "Skyborne (Windshaper)", "icon": "race_skyborne", "classes": ["Warrior", "Hunter", "Rogue", "Shaman", "Druid"], "abilities": [
    ["Walk on Air", "Instant, 2 min cooldown. Glide downward through the air for 10 sec while controlling your direction of travel.", "inv_elemental_primal_air"],
    ["Skysight", "0.5 sec cast, 2 min cooldown. Attempt to draw power from a convergence of elements and receive its blessing, increasing your movement and mounted movement speeds by 10%. Lasts 30 sec if no elemental convergence is nearby, and 15 min if one is found.", "ability_skyreach_lens_flare"],
    ["Elemental Insight", "Damage dealt versus Elementals increased by 5%.", "achievement_raidprimalist_windelemental"],
    ["Wind Blessed", "Increases your spellcasting, melee, and ranged Haste by 1%.", "inv_misc_volatileair"] ] }
 ],
 "Alliance": [
  { "race": "Human", "icon": "race_human_male", "classes": ["Warrior", "Paladin", "Hunter", "Rogue", "Priest", "Mage", "Warlock"], "abilities": [
    ["Sword Specialization", "Increases your critical strike chance with all spells and attacks by 2% while you have a sword or two-handed sword equipped.", "ability_meleedamage"],
    ["The Human Spirit", "Spirit increased by 5%.", "inv_enchant_shardbrilliantsmall"],
    ["Perception", "Instant, 3 min cooldown. Dramatically increases stealth detection for 20 sec.", "spell_nature_sleep"],
    ["Will to Survive", "Instant, 3 min cooldown. Instantly removes all Stun effects.", "spell_shadow_charm"] ] },
  { "race": "Dwarf", "icon": "race_dwarf_male", "classes": ["Warrior", "Paladin", "Hunter", "Rogue", "Priest", "Shaman"], "abilities": [
    ["Find Treasure", "Instant. Allows the dwarf to sense nearby treasure, making it appear on the minimap.  Lasts until canceled.", "racial_dwarf_findtreasure"],
    ["Stoneform", "Instant, 3 min cooldown. Instantly removes and grants immunity to all Bleed, Poison, and Disease effects, and reduces all Physical damage taken by 10% for 8 sec.", "spell_shadow_unholystrength"],
    ["Mace Specialization", "Increases your critical strike chance with all spells and attacks by 1% while you have a mace or two-handed mace equipped.", "inv_hammer_05"],
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
    ["Eureka!", "Instant, 2 min cooldown. Your next 3 non-periodic damaging abilities cost 10% less (Mana, Rage or Energy) and deal 10% more damage. For healers, your next 3 non-periodic damaging or healing abilities cost 10% less Mana and do 10% more. Periodic effects get nothing from it; a channeled spell is not periodic.", "inv_gnometoy"] ] },
  { "race": "Skyborne (High Order)", "icon": "race_skyborne", "classes": ["Warrior", "Hunter", "Rogue", "Mage", "Druid"], "abilities": [
    ["Walk on Air", "Instant, 2 min cooldown. Glide downward through the air for 10 sec while controlling your direction of travel.", "inv_elemental_primal_air"],
    ["Read Ley Line", "2 sec cast, 2 min cooldown. Attempt to tap into the power of a nearby ley line, increasing your Health and Mana regeneration by 100%. Lasts 15 sec if no ley line is nearby, and 15 min if one is found.", "ability_mage_incantersabsorbtion"],
    ["Elemental Insight", "Damage dealt versus Elementals increased by 5%.", "achievement_raidprimalist_windelemental"],
    ["Wind Blessed", "Increases your spellcasting, melee, and ranged Haste by 1%.", "inv_misc_volatileair"] ] }
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
     "225 Mana, 20 yd range, Instant, 2 min cooldown. Chastise the target, causing 272 to 306 Holy damage and Immobilizing them for up to 2 sec. Only works against Humanoids.  This spell causes very low threat",
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
     "Instant, 10 min cooldown. Cannibalize 1,600 of your own Health over 15 sec to gain 1,600 Mana.",
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
 "Paladin": [["Judgement", "Changed. It no longer eats your seal. 10 yd range, 10 sec cooldown. Judging Seal of Fury taunts for 4 sec, so Paladins can tank pulls now.", "spell_holy_righteousfury"], ["Seal of Fury", "The tank seal. Every hit adds Holy damage, and with a shield up you get an absorb worth half of it. Rank 4 by level 38.", "spell_holy_sealoffury"], ["Holy Strike", "Baseline Ret strike on a 10 sec cooldown: weapon damage plus Holy. Rank 5 by 38. Several talents build on it.", "spell_holy_crusaderstrike"], ["Blessing of Kings and Consecration", "Both trainable now, not talents. Consecration comes at level 20.", "spell_magic_greaterblessingofkings"]],
 "Priest": [["Shadow Word: Death", "Execute-style Shadow spell. Named by the Early Demise talent.", "spell_shadow_demonicfortitude"], ["Devouring Plague", "A normal Shadow spell now, not an Undead racial. Rank 3 by 38, 1 min cooldown.", "spell_shadow_blackplague"], ["Fear Ward", "Every Priest gets it. 3 min cooldown.", "spell_holy_excorcism"]],
 "Hunter": [["Aimed Shot", "Trainable now instead of a Marksmanship talent, and quicker: 2 sec cast, 6 sec cooldown, shared with Multi-Shot (Classic was a 3 sec cast). Rank 3 by 38. A reader caught the cast time on Xaryu's stream.", "inv_spear_07"], ["Call Owl", "Call Pet is named after your pet. The demo Hunter's read Call Owl.", "ability_hunter_beastcall"], ["Aspect of the Beast", "Changed. Rank 1 makes you untrackable and adds 50 melee attack power. Classic was untrackable only. Spotted by a reader on Xaryu's stream.", "ability_mount_pinktiger"]],
 "Mage": [["Comprehend Scroll", "New little ability: decipher an untranslated scroll. Seen on a Skyborne Mage.", "inv_scroll_03"], ["Frostfire Bolt", "A bolt that is both Fire and Frost. Four talents mention it.", "ability_mage_frostfirebolt"]],
 "Warlock": [["Subjugate Demon", "Enslave Demon, renamed. Rank 1 by 38.", "spell_shadow_enslavedemon"], ["Bane of Agony", "Curse of Agony, renamed. Bane of Doom the same. Banes and Curses are now separate, so you can run one of each.", "spell_shadow_curseofsargeras"], ["Incubus", "Male counterpart to the Succubus, its own summon. Named by four Demonology talents.", "spell_shadow_summonsuccubus"]],
 "Warrior": [["Rage", "Rage comes from taking damage and from your melee swings. Slower weapons give more Rage per swing, so it comes in at a steady rate instead of scaling with how hard you hit. Out of combat you lose 1.25 Rage a second (75 a minute). From the beta's Rage tooltip, and Blizzard's Class Highlights video (0:23).", "ability_warrior_endlessrage"], ["Victory Rush", "Baseline, in the Arms tab. Instant, 30 sec cooldown: a melee hit that heals you for 10% of your maximum health, usable within 20 sec of killing something non-trivial. Read off Soda's stream via a reader.", "ability_warrior_devastate"], ["Tactical Mastery", "A passive in the Arms tab now, not a talent. You keep up to 10 Rage when you change stances on your own, and the Arms talent Improved Tactical Mastery adds up to 15 more. Read off Soda's Warrior video via a reader.", "ability_warrior_decisivestrike"], ["Intercept", "Still in the game: the Fury tree has Improved Intercept. It just isn't in the level 38 spellbook, so it's probably learned later than 30 now.", "ability_rogue_sprint"], ["Slam", "Rank 3 by 38 (Classic reached that at 46) and it has an 18 sec cooldown now.", "ability_warrior_decisivestrike"], ["Thunder Clap", "Changed. Works in Battle or Defensive Stance. Rank 4 slows attacks 20% for 22 sec and hits up to 4 targets, where Classic was 10% for the same 22 sec. Read off Xaryu's stream, thanks to a reader; the Classic number from the beta files.", "spell_nature_thunderclap"], ["Bloodrage", "Still there, in the Protection tab. 116 health for 10 rage plus 10 more over 10 sec.", "ability_racial_bloodrage"], ["Shield Wall", "Changed: 15 min cooldown, 60% less damage for 12 sec (Classic was 30 min, 75% for 10 sec). It no longer shares a cooldown with Retaliation and Recklessness: each has its own timer in the beta files, and Blizzard says so in its Class Highlights video (1:14). Two readers flagged it first.", "ability_warrior_shieldwall"], ["Shield Block", "Changed: 2 charges and 7 sec baseline (Classic was 1 block for 5 sec). Still 10 Rage, 5 sec cooldown, Defensive Stance. Read from a Tyler1 spellbook screenshot a reader sent in.", "ability_defend"]],
 "Rogue": [["Energy", "Energy comes back 1 point every 0.1 sec, 10 a second. Same rate as Classic, but no tick to wait for. From the beta's Energy tooltip, and Blizzard's Class Highlights video (3:41).", "spell_shadow_fumble"], ["Mutilate", "New talent, Assassination row 5. Hits with both weapons for 75% damage each, 20% more on poisoned targets, and gives 2 combo points. Nine other talents feed it.", "ability_rogue_deadlybrew"], ["Venom", "New finisher at the bottom of Assassination. Your poisons do 30% more and apply 10% more often, longer per combo point.", "inv_sword_31"], ["Thousand Cuts", "New Subtlety capstone. Each Rupture tick takes 3 Energy off your next Hemorrhage or Backstab, stacking to 5.", "ability_rogue_slaughterfromtheshadows"], ["Axes", "Rogues can use one-handed axes now. The Hack and Slash talent lists Axe/Sword as a weapon group.", "inv_axe_09"]],
 "Druid": [["Omen of Clarity and Nature's Grasp", "Both trainable now, not talents. They're in the Balance tab at 38.", "spell_nature_crystalball"], ["Revive", "New out-of-combat resurrection, 10 sec cast. Rebirth keeps its 30 min cooldown.", "ability_druid_lunarguidance"], ["Lacerate", "Bear bleed from later expansions, in Forever as a baseline ability: the Shredding Attacks talent cuts its Rage cost. Not in the level 38 spellbook, so it comes later. Thanks to a reader.", "ability_druid_lacerate"], ["Cure Poison", "Gone. Abolish Poison is the only poison cure.", "spell_nature_nullifypoison"]],
 "Shaman": [["Lightning Bolt", "Half a second faster than Classic. Rank 7 is a 2.5 sec cast.", "spell_nature_lightning"], ["Chain Lightning", "Also half a second faster: rank 1 is a 2 sec cast, 6 sec cooldown, 3 targets, each jump 30% weaker. Max Elemental Alacrity brings Lightning Bolt to the same 2 sec.", "spell_nature_chainlightning"], ["Totemic Projection", "New. Pick a spot up to 30 yd away and your totems move there, not just to your feet. Seen on Guzu's stream: a green circle on the ground, then the totems appear by the mob. Totemic Recall is in too.", "ability_shaman_totemrelocation"], ["Totems last 5 min", "Lasting totems last 5 min now. Most were 2 min in Classic, and Healing Stream and Mana Spring were 1 min. Disease Cleansing Totem still lasts 2 min in the beta. Searing (30 sec), Magma (20), Stoneclaw (15), Earthbind and Grounding (45) and Mana Tide (12) keep their short timers. From the beta files; Blizzard's Class Highlights video (3:00) says five minutes.", "spell_nature_strengthofearthtotem02"], ["Call of the Elements, Ancestors and Spirits", "New: each drops up to four totems from its own Totem Bar set in one 3 sec cast. Call of the Elements at 20, Call of the Ancestors at 30, Call of the Spirits at 40, so three saved sets by 40.", "spell_shaman_dropall_01"], ["Ghost Wolf", "Still a 3 sec cast, but Improved Ghost Wolf now takes 1 sec off at rank 1 and the whole 3 sec at rank 2, and lets it work indoors, so at 2/2 it is instant, as Guzu's tooltip showed.", "spell_nature_spiritwolf"], ["Fire Nova", "A spell now, not a totem: 30 yd range, instant, 10 sec cooldown, and it blasts everything within 10 yd of your active Fire totem (rank 3 does 195 to 219 and comes at 32, rank 5 413 to 459 at 52). Improved Fire Nova trims 2 or 4 sec off the cooldown. From the beta client.", "spell_fire_sealoffire"]]
};
// data revised 2026-09-13: Night Elf priest spells and Warrior Victory Rush confirmed on stream footage
