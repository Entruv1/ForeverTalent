// Legacy perks: the three account-wide trees, playable. Read from the Forever beta client (positions, prerequisites, point gates and every rank's text).
window.LEGACY = {
 "note": "Earned from challenges anywhere on your account, and every character gets the same points to spend in its own trees. 16 points at launch. Some perks need points in their tree first, a few need the perk before them. The ? slots are placeholders.",
 "points": 16,
 "source": "Forever beta client 1.60.1.70425",
 "trees": [
  {
   "id": 1188,
   "name": "Adventure",
   "icon": "inv_misc_map_01",
   "perks": [
    {
     "name": "High Alert",
     "max": 2,
     "row": 1,
     "col": 2,
     "icon": "spell_shadow_detectlesserinvisibility",
     "ranks": [
      "Increases your ability to detect nearby targets with Stealth as if your level were increased by 1. Ineffective in Battlegrounds.",
      "Increases your ability to detect nearby targets with Stealth as if your level were increased by 2. Ineffective in Battlegrounds."
     ],
     "gate": 5
    },
    {
     "name": "Well Rested",
     "max": 5,
     "row": 2,
     "col": 1,
     "icon": "spell_nature_sleep",
     "ranks": [
      "Your rested experience accumulates 4% faster and your rested experience cap is increased by 4%.",
      "Your rested experience accumulates 8% faster and your rested experience cap is increased by 8%.",
      "Your rested experience accumulates 12% faster and your rested experience cap is increased by 12%.",
      "Your rested experience accumulates 16% faster and your rested experience cap is increased by 16%.",
      "Your rested experience accumulates 20% faster and your rested experience cap is increased by 20%."
     ],
     "gate": 0
    },
    {
     "name": "Talented",
     "max": 5,
     "row": 2,
     "col": 2,
     "icon": "ability_marksmanship",
     "ranks": [
      "You gain talent points every level starting at level 9 instead of starting at level 10, but you still may not have more than 51 total talent points.",
      "You gain talent points every level starting at level 8 instead of starting at level 10, but you still may not have more than 51 total talent points.",
      "You gain talent points every level starting at level 7 instead of starting at level 10, but you still may not have more than 51 total talent points.",
      "You gain talent points every level starting at level 6 instead of starting at level 10, but you still may not have more than 51 total talent points.",
      "You gain talent points every level starting at level 5 instead of starting at level 10, but you still may not have more than 51 total talent points."
     ],
     "gate": 5,
     "req": "Well Rested"
    },
    {
     "name": "Unknown",
     "max": 1,
     "row": 2,
     "col": 3,
     "icon": "inv_misc_questionmark",
     "ranks": [
      "To be added in a future update."
     ],
     "gate": 0,
     "placeholder": true
    },
    {
     "name": "Unknown",
     "max": 1,
     "row": 2,
     "col": 4,
     "icon": "inv_misc_questionmark",
     "ranks": [
      "To be added in a future update."
     ],
     "gate": 0,
     "placeholder": true
    },
    {
     "name": "Thrill of Adventure",
     "max": 5,
     "row": 3,
     "col": 1,
     "icon": "ability_hunter_huntervswild",
     "ranks": [
      "You gain 1% of your maximum Health and Mana over 10 sec each time you deliver the killing blow to a non-trivial enemy. Ineffective in dungeons, raids, and battlegrounds.",
      "You gain 2% of your maximum Health and Mana over 10 sec each time you deliver the killing blow to a non-trivial enemy. Ineffective in dungeons, raids, and battlegrounds.",
      "You gain 3% of your maximum Health and Mana over 10 sec each time you deliver the killing blow to a non-trivial enemy. Ineffective in dungeons, raids, and battlegrounds.",
      "You gain 4% of your maximum Health and Mana over 10 sec each time you deliver the killing blow to a non-trivial enemy. Ineffective in dungeons, raids, and battlegrounds.",
      "You gain 5% of your maximum Health and Mana over 10 sec each time you deliver the killing blow to a non-trivial enemy. Ineffective in dungeons, raids, and battlegrounds."
     ],
     "gate": 0
    },
    {
     "name": "Field Guide",
     "max": 3,
     "row": 3,
     "col": 2,
     "icon": "inv_fishingchair",
     "ranks": [
      "Reduces your cooldown on adding Camp features by 8%",
      "Reduces your cooldown on adding Camp features by 17%",
      "Reduces your cooldown on adding Camp features by 25%"
     ],
     "gate": 5
    },
    {
     "name": "Frequent Flier",
     "max": 1,
     "row": 3,
     "col": 3,
     "icon": "achievement_guild_ridelikethewind",
     "ranks": [
      "You receive a 50% discount on all flight paths, and your flight path mount flies 20% faster."
     ],
     "gate": 10,
     "req": "Field Guide"
    },
    {
     "name": "Field Medicine",
     "max": 2,
     "row": 4,
     "col": 2,
     "icon": "inv_misc_bandage_05",
     "ranks": [
      "Reduces the duration of the Recently Bandaged effect by 5 sec when you use a bandage. Ineffective in dungeons, raids, and battlegrounds.",
      "Reduces the duration of the Recently Bandaged effect by 10 sec when you use a bandage. Ineffective in dungeons, raids, and battlegrounds."
     ],
     "gate": 5
    }
   ]
  },
  {
   "id": 1189,
   "name": "Resourcefulness",
   "icon": "inv_misc_coin_01",
   "perks": [
    {
     "name": "For Great Honor",
     "max": 5,
     "row": 1,
     "col": 2,
     "icon": "achievement_bg_winwsg",
     "ranks": [
      "Increases Honor Points gained by 2%.",
      "Increases Honor Points gained by 4%.",
      "Increases Honor Points gained by 6%.",
      "Increases Honor Points gained by 8%.",
      "Increases Honor Points gained by 10%."
     ],
     "gate": 5
    },
    {
     "name": "Gourmand",
     "max": 3,
     "row": 2,
     "col": 1,
     "icon": "inv_misc_food_64",
     "ranks": [
      "Increases the duration of beneficial effects from eating food by 33%.",
      "Increases the duration of beneficial effects from eating food by 67%.",
      "Increases the duration of beneficial effects from eating food by 100%."
     ],
     "gate": 0
    },
    {
     "name": "Permanence",
     "max": 2,
     "row": 2,
     "col": 2,
     "icon": "spell_misc_emotionhappy",
     "ranks": [
      "Your class abilities which grant long-duration stat or attribute benefits to all party or raid members last 50% longer, and the benefits you gain from resting at a camp last 50% longer.",
      "Your class abilities which grant long-duration stat or attribute benefits to all party or raid members last 100% longer, and the benefits you gain from resting at a camp last 100% longer."
     ],
     "gate": 5,
     "req": "Gourmand"
    },
    {
     "name": "Unknown",
     "max": 1,
     "row": 2,
     "col": 3,
     "icon": "inv_misc_questionmark",
     "ranks": [
      "To be added in a future update."
     ],
     "gate": 0,
     "placeholder": true
    },
    {
     "name": "Unknown",
     "max": 1,
     "row": 2,
     "col": 4,
     "icon": "inv_misc_questionmark",
     "ranks": [
      "To be added in a future update."
     ],
     "gate": 0,
     "placeholder": true
    },
    {
     "name": "The Quick and the Dead",
     "max": 2,
     "row": 3,
     "col": 1,
     "icon": "spell_shadow_deadofnight",
     "ranks": [
      "Increases movement speed while dead by 5% and your helpful spells and abilities cost no resources for 1 min after being resurrected or until you enter combat.",
      "Increases movement speed while dead by 10% and your helpful spells and abilities cost no resources for 2 min after being resurrected or until you enter combat."
     ],
     "gate": 0
    },
    {
     "name": "Reagent Economy",
     "max": 1,
     "row": 3,
     "col": 3,
     "icon": "inv_misc_candle_02",
     "ranks": [
      "Your class abilities no longer require reagents purchaseable from vendors."
     ],
     "gate": 10,
     "req": "The Quick and the Dead"
    },
    {
     "name": "Reinforce",
     "max": 5,
     "row": 4,
     "col": 1,
     "icon": "inv_misc_armorkit_17",
     "ranks": [
      "You take 8% less durability loss when you die.",
      "You take 16% less durability loss when you die.",
      "You take 24% less durability loss when you die.",
      "You take 32% less durability loss when you die.",
      "You take 40% less durability loss when you die."
     ],
     "gate": 0
    },
    {
     "name": "Diplomat",
     "max": 5,
     "row": 4,
     "col": 2,
     "icon": "inv_scroll_03",
     "ranks": [
      "Increases your reputation gains by 2%.",
      "Increases your reputation gains by 4%.",
      "Increases your reputation gains by 6%.",
      "Increases your reputation gains by 8%.",
      "Increases your reputation gains by 10%."
     ],
     "gate": 5
    }
   ]
  },
  {
   "id": 1187,
   "name": "Professions",
   "icon": "trade_engineering",
   "perks": [
    {
     "name": "Master Chef",
     "max": 5,
     "row": 1,
     "col": 2,
     "icon": "achievement_profession_chefhat",
     "ranks": [
      "Your cooking recipes have a 10% chance to create an extra result.",
      "Your cooking recipes have a 20% chance to create an extra result.",
      "Your cooking recipes have a 30% chance to create an extra result.",
      "Your cooking recipes have a 40% chance to create an extra result.",
      "Your cooking recipes have a 50% chance to create an extra result."
     ],
     "gate": 5
    },
    {
     "name": "Working Overtime",
     "max": 5,
     "row": 2,
     "col": 1,
     "icon": "inv_misc_pocketwatch_03",
     "ranks": [
      "Increases your chance to gain a skill increase from using any primary, secondary, or class-based tradeskill by 4%.",
      "Increases your chance to gain a skill increase from using any primary, secondary, or class-based tradeskill by 8%.",
      "Increases your chance to gain a skill increase from using any primary, secondary, or class-based tradeskill by 12%.",
      "Increases your chance to gain a skill increase from using any primary, secondary, or class-based tradeskill by 16%.",
      "Increases your chance to gain a skill increase from using any primary, secondary, or class-based tradeskill by 20%."
     ],
     "gate": 0
    },
    {
     "name": "Bartering",
     "max": 2,
     "row": 2,
     "col": 2,
     "icon": "inv_misc_coin_06",
     "ranks": [
      "Reduces the gold price of items from all vendors by 5%.",
      "Reduces the gold price of items from all vendors by 10%."
     ],
     "gate": 5
    },
    {
     "name": "Dedicated Study",
     "max": 1,
     "row": 2,
     "col": 3,
     "icon": "inv_misc_book_08",
     "ranks": [
      "Increases your skill by 1 in your lowest tradeskill among your Primary and Secondary tradeskills. If you have already reached 300 skill in your two current Primary Tradeskills and all three Secondary Tradeskills, you will gain 2 to 4 of a random Elemental Essence."
     ],
     "gate": 10,
     "passive": false,
     "cost": "25 sec cast | 23 hour cooldown",
     "req": "Bartering"
    },
    {
     "name": "Bountiful Harvest",
     "max": 5,
     "row": 3,
     "col": 1,
     "icon": "inv_misc_bag_18",
     "ranks": [
      "You discover 20% more Scarce materials from Mining, Herbalism, and Skinning.",
      "You discover 40% more Scarce materials from Mining, Herbalism, and Skinning.",
      "You discover 60% more Scarce materials from Mining, Herbalism, and Skinning.",
      "You discover 80% more Scarce materials from Mining, Herbalism, and Skinning.",
      "You discover 100% more Scarce materials from Mining, Herbalism, and Skinning."
     ],
     "gate": 0
    },
    {
     "name": "Performance Bonus",
     "max": 3,
     "row": 3,
     "col": 2,
     "icon": "racial_dwarf_findtreasure",
     "ranks": [
      "You have a 5% chance to receive 100% increased Merchant's Favor when you turn in a crate to the Azeroth Commerce Authority or Durotar Supply and Logistics.",
      "You have a 10% chance to receive 100% increased Merchant's Favor when you turn in a crate to the Azeroth Commerce Authority or Durotar Supply and Logistics.",
      "You have a 15% chance to receive 100% increased Merchant's Favor when you turn in a crate to the Azeroth Commerce Authority or Durotar Supply and Logistics."
     ],
     "gate": 5,
     "req": "Bountiful Harvest"
    },
    {
     "name": "Unknown",
     "max": 1,
     "row": 3,
     "col": 3,
     "icon": "inv_misc_questionmark",
     "ranks": [
      "To be added in a future update."
     ],
     "gate": 0,
     "placeholder": true
    },
    {
     "name": "Unknown",
     "max": 1,
     "row": 3,
     "col": 4,
     "icon": "inv_misc_questionmark",
     "ranks": [
      "To be added in a future update."
     ],
     "gate": 0,
     "placeholder": true
    },
    {
     "name": "Luremaster",
     "max": 2,
     "row": 4,
     "col": 2,
     "icon": "inv_misc_basket_04",
     "ranks": [
      "While fishing with a Lure active, you have a 25% chance to catch an extra fish.",
      "While fishing with a Lure active, you have a 50% chance to catch an extra fish."
     ],
     "gate": 5
    }
   ]
  }
 ],
 "challenges": [
  {
   "group": "Dungeons and raids",
   "name": "Conqueror of the Lair",
   "desc": "Defeat Onyxia.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Novice Warrior",
   "desc": "Reach level 25 for the first time on a Warrior.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Experienced Warrior",
   "desc": "Reach level 45 for the first time on a Warrior.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Master Warrior",
   "desc": "Reach level 60 for the first time on a Warrior.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Novice Druid",
   "desc": "Reach level 25 for the first time on a Druid.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Experienced Druid",
   "desc": "Reach level 45 for the first time on a Druid.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Master Druid",
   "desc": "Reach level 60 for the first time on a Druid.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Novice Hunter",
   "desc": "Reach level 25 for the first time on a Hunter.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Experienced Hunter",
   "desc": "Reach level 45 for the first time on a Hunter.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Master Hunter",
   "desc": "Reach level 60 for the first time on a Hunter.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Novice Mage",
   "desc": "Reach level 25 for the first time on a Mage.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Experienced Mage",
   "desc": "Reach level 45 for the first time on a Mage.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Master Mage",
   "desc": "Reach level 60 for the first time on a Mage.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Novice Paladin",
   "desc": "Reach level 25 for the first time on a Paladin.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Experienced Paladin",
   "desc": "Reach level 45 for the first time on a Paladin.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Master Paladin",
   "desc": "Reach level 60 for the first time on a Paladin.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Novice Priest",
   "desc": "Reach level 25 for the first time on a Priest.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Experienced Priest",
   "desc": "Reach level 45 for the first time on a Priest.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Master Priest",
   "desc": "Reach level 60 for the first time on a Priest.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Novice Rogue",
   "desc": "Reach level 25 for the first time on a Rogue.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Experienced Rogue",
   "desc": "Reach level 45 for the first time on a Rogue.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Master Rogue",
   "desc": "Reach level 60 for the first time on a Rogue.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Novice Shaman",
   "desc": "Reach level 25 for the first time on a Shaman.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Experienced Shaman",
   "desc": "Reach level 45 for the first time on a Shaman.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Master Shaman",
   "desc": "Reach level 60 for the first time on a Shaman.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Novice Warlock",
   "desc": "Reach level 25 for the first time on a Warlock.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Experienced Warlock",
   "desc": "Reach level 45 for the first time on a Warlock.",
   "points": 1
  },
  {
   "group": "Classes",
   "name": "Master Warlock",
   "desc": "Reach level 60 for the first time on a Warlock.",
   "points": 1
  },
  {
   "group": "Crafting",
   "name": "Journeyman Alchemist",
   "desc": "Reach 150 skill in Alchemy for the first time.",
   "points": 1
  },
  {
   "group": "Crafting",
   "name": "Expert Alchemist",
   "desc": "Reach 225 skill in Alchemy for the first time.",
   "points": 1
  },
  {
   "group": "Crafting",
   "name": "Artisan Alchemist",
   "desc": "Reach 300 skill in Alchemy for the first time.",
   "points": 1
  },
  {
   "group": "Crafting",
   "name": "Journeyman Blacksmith",
   "desc": "Reach 150 skill in Blacksmithing for the first time.",
   "points": 1
  },
  {
   "group": "Crafting",
   "name": "Expert Blacksmith",
   "desc": "Reach 225 skill in Blacksmithing for the first time.",
   "points": 1
  },
  {
   "group": "Crafting",
   "name": "Artisan Blacksmith",
   "desc": "Reach 300 skill in Blacksmithing for the first time.",
   "points": 1
  },
  {
   "group": "Crafting",
   "name": "Journeyman Enchanter",
   "desc": "Reach 150 skill in Enchanting for the first time.",
   "points": 1
  },
  {
   "group": "Crafting",
   "name": "Expert Enchanter",
   "desc": "Reach 225 skill in Enchanting for the first time.",
   "points": 1
  },
  {
   "group": "Crafting",
   "name": "Artisan Enchanter",
   "desc": "Reach 300 skill in Enchanting for the first time.",
   "points": 1
  },
  {
   "group": "Crafting",
   "name": "Journeyman Engineer",
   "desc": "Reach 150 skill in Engineering for the first time.",
   "points": 1
  },
  {
   "group": "Crafting",
   "name": "Expert Engineer",
   "desc": "Reach 225 skill in Engineering for the first time.",
   "points": 1
  },
  {
   "group": "Crafting",
   "name": "Artisan Engineer",
   "desc": "Reach 300 skill in Engineering for the first time.",
   "points": 1
  },
  {
   "group": "Crafting",
   "name": "Journeyman Leatherworker",
   "desc": "Reach 150 skill in Leatherworking for the first time.",
   "points": 1
  },
  {
   "group": "Crafting",
   "name": "Expert Leatherworker",
   "desc": "Reach 225 skill in Leatherworking for the first time.",
   "points": 1
  },
  {
   "group": "Crafting",
   "name": "Artisan Leatherworker",
   "desc": "Reach 300 skill in Leatherworking for the first time.",
   "points": 1
  },
  {
   "group": "Crafting",
   "name": "Journeyman Tailor",
   "desc": "Reach 150 skill in Tailoring for the first time.",
   "points": 1
  },
  {
   "group": "Crafting",
   "name": "Expert Tailor",
   "desc": "Reach 225 skill in Tailoring for the first time.",
   "points": 1
  },
  {
   "group": "Crafting",
   "name": "Artisan Tailor",
   "desc": "Reach 300 skill in Tailoring for the first time.",
   "points": 1
  },
  {
   "group": "Dungeons and raids",
   "name": "Novice Spelunker",
   "desc": "Complete the following dungeons.",
   "points": 1
  },
  {
   "group": "Dungeons and raids",
   "name": "Experienced Spelunker",
   "desc": "Complete the following dungeons.",
   "points": 1
  },
  {
   "group": "Dungeons and raids",
   "name": "Master Spelunker",
   "desc": "Complete the following dungeons.",
   "points": 1
  },
  {
   "group": "Dungeons and raids",
   "name": "Conqueror of the Wilds",
   "desc": "Defeat the following encounters in Hyjal Summit.",
   "points": 1
  },
  {
   "group": "Dungeons and raids",
   "name": "Conqueror of the Deeps",
   "desc": "Defeat the following encounters in the Barrow Deeps.",
   "points": 1
  },
  {
   "group": "PvP",
   "name": "Rank 3",
   "desc": "Reach the rank of Sergeant in the Player vs. Player Honor System.",
   "points": 1
  },
  {
   "group": "PvP",
   "name": "Rank 7",
   "desc": "Reach the rank of Knight-Lieutenant or Blood Guard in the Player vs. Player Honor System.",
   "points": 1
  },
  {
   "group": "PvP",
   "name": "Rank 10",
   "desc": "Reach the rank of Lieutenant-Commander or Champion in the Player vs. Player Honor System.",
   "points": 1
  },
  {
   "group": "PvP",
   "name": "Rank 13",
   "desc": "Reach the rank of Field Marshal or Warlord in the Player vs. Player Honor System.",
   "points": 1
  },
  {
   "group": "PvP",
   "name": "Rank 14",
   "desc": "Reach the rank of Grand Marshal or High Warlord in the Player vs. Player Honor System.",
   "points": 1
  },
  {
   "group": "PvP",
   "name": "Master of Alterac Valley",
   "desc": "Reach exalted reputation with the Frostwolf Clan or Stormpike Guard.",
   "points": 1
  },
  {
   "group": "PvP",
   "name": "Master of Arathi Basin",
   "desc": "Reach exalted reputation with the Defilers or League of Arathor.",
   "points": 1
  },
  {
   "group": "PvP",
   "name": "Master of Warsong Gulch",
   "desc": "Reach exalted reputation with the Warsong Outriders or Silverwing Sentinels.",
   "points": 1
  },
  {
   "group": "PvP",
   "name": "Master of Darkspear Islands",
   "desc": "Reach exalted reputation with the Darkspear Raiders or Theramore Expeditionary Force.",
   "points": 1
  },
  {
   "group": "Other",
   "name": "Lord Valthalak Laid to Rest",
   "desc": "Complete the questline beginning with An Earnest Proposition, and ending with Saving the Best for Last.",
   "points": 1
  },
  {
   "group": "Other",
   "name": "Explorer",
   "desc": "Have a character with the Explore Azeroth achievement.",
   "points": 1
  },
  {
   "group": "PvP",
   "name": "Field of Honor: Week 4",
   "desc": "Complete Week 4 of the Field of Honor Journey.",
   "points": 1
  },
  {
   "group": "PvP",
   "name": "Field of Honor: Week 7",
   "desc": "Complete Week 7 of the Field of Honor Journey.",
   "points": 1
  },
  {
   "group": "PvP",
   "name": "Field of Honor: Week 10",
   "desc": "Complete Week 10 of the Field of Honor Journey.",
   "points": 1
  }
 ]
};
