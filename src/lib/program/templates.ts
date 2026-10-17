// Template WeekContent: hand-written free week 1 for every theme and level, and a generator for any other week.
// Part B uses templateContentFor() whenever AI is off, down, or over its monthly limit, so it must always work.
// Every string follows docs/content-guide.md: no em dashes, nothing addressed to the child in parent text,
// and the child's name is the literal {{name}} (swapped in the browser at print time).
import { PLANS, FAMILIES, type Level, type Week } from '../homeschool';
import lettersData from '../../data/letters.json';
import type { ChildProfile, ProgramWeek, ThemeId, WeekContent } from './types';
import { THEMES, storyIcon, iconKind, type ThemeIcon } from './themes';
import { baseWeekOf, reviewLetters, type MathStep } from './engine';
import { SCENES } from './scenes';
import { readyPaths, pageLengthProblem } from './story';
import { STORY_TEXTS } from './storyTexts';

type Problem = WeekContent['wordProblems'][number];
const add = (text: string, a: number, b: number, icon?: string): Problem => ({ text, a, b, op: '+', answer: a + b, ...(icon ? { icon } : {}) });
const sub = (text: string, a: number, b: number, icon?: string): Problem => ({ text, a, b, op: '-', answer: a - b, ...(icon ? { icon } : {}) });
const cmp = (text: string, a: number, b: number, icon?: string): Problem => ({ text, a, b, op: 'compare', answer: Math.max(a, b), ...(icon ? { icon } : {}) });

// ---------- Free week 1, written by hand ----------
// Pre-K week 1 is the name week (letters in their name, the number 1). Kindergarten week 1 is the name week
// with the sight words "a" and "and". Pre-K stories are read aloud; Kindergarten stories lean on short words
// a beginning reader can sound out, plus "a" and "and".

const PRE_K_TEACHES = 'This week is all about {{name}}\'s name: tracing it, finding its letters, and coloring it. Math is the number 1.';
const PRE_K_WHY = 'A name is the word kids care about most, so it is a friendly first word to learn. Knowing the letters in their own name helps many kids start noticing letters everywhere.';
const K_TEACHES = 'This week {{name}} practices writing their name and reads two of the most common words in books: a and and. Math is counting and the number 1.';
const K_WHY = 'Writing their own name is a big early writing step, and a and and show up on almost every page of picture books. Spotting them early makes this week\'s story feel like real reading.';

interface Free { story: WeekContent['story']; problems: Problem[]; sentence: string; activities: string[] }

const FREE: Record<ThemeId, Record<Level, Free>> = {
  dinosaurs: {
    'pre-k': {
      story: { title: '{{name}} and the Little T-rex', pages: [
        'One sunny morning, {{name}} found one big egg.',
        'Crack! Out popped one little T-rex.',
        'The T-rex could not say its name. So {{name}} said it slowly, letter by letter.',
        'They stomped past one volcano and one tall palm tree.',
        'At the end of the day, the T-rex curled up in a nest of leaves.',
        'Good night, little T-rex. Good night, {{name}}.',
      ], icons: ['egg', 't-rex', 't-rex', 'volcano', 't-rex', 't-rex'] },
      problems: [
        add('{{name}} finds 1 bone. Then {{name}} finds 1 more. How many bones now?', 1, 1, 'bone'),
        add('2 dinosaur eggs sit in a nest. 1 more egg rolls in. How many eggs?', 2, 1, 'egg'),
        add('The little T-rex makes 3 footprints. Then it makes 1 more. How many footprints?', 3, 1, 'footprint'),
        cmp('{{name}} sees 2 bones. The T-rex sees 4 bones. Write the bigger number.', 2, 4, 'bone'),
      ],
      sentence: 'I see a T-rex.',
      activities: [
        'Line up toy dinosaurs (or blocks) and spell {{name}}\'s name with sticky notes on their backs. Mix them up and line them up again.',
        'Play "one stomp": say a number, and {{name}} stomps that many times like a T-rex. Keep it to 1, 2 and 3 this week.',
      ],
    },
    kindergarten: {
      story: { title: '{{name}} Can Dig', pages: [
        '{{name}} has a big hat and a red pan to dig up a bone.',
        '{{name}} can dig and dig in the mud by a big footprint.',
        'Look! A big bone and a big egg.',
        'The egg can crack. Tap, tap, tap!',
        'It is a T-rex! The T-rex is not big. It is a little T-rex.',
        '{{name}} and the T-rex sit in the sun.',
      ], icons: ['bone', 'footprint', 'bone', 'egg', 't-rex', 't-rex'] },
      problems: [
        add('{{name}} digs up 2 bones. Then {{name}} digs up 3 more. How many bones in all?', 2, 3, 'bone'),
        add('There are 4 eggs in a nest and 1 more egg. How many eggs?', 4, 1, 'egg'),
        sub('5 dinosaur eggs sit in the sun. 2 eggs hatch and the babies run off. How many eggs are left?', 5, 2, 'egg'),
        add('3 long-neck dinosaurs drink at the lake. 3 more come to drink. How many long-necks?', 3, 3, 'long-neck'),
        cmp('{{name}} counts 6 footprints. A friend counts 4. Write the bigger number.', 6, 4, 'footprint'),
      ],
      sentence: 'A T-rex and a big egg.',
      activities: [
        'Hide small toy dinosaurs in a bin of rice or dry beans. Each time {{name}} digs one out, write a letter of their name on a sticky note until the whole name is there.',
        'Go on an "a and and" hunt in a dinosaur book. {{name}} taps a toy dinosaur on each a or and on the page.',
      ],
    },
  },

  trucks: {
    'pre-k': {
      story: { title: '{{name}} Drives the Big Truck', pages: [
        'Beep, beep! Here comes one big dump truck.',
        '{{name}} climbs up into the dump truck and holds the big wheel.',
        'They drive past one bus, one car and one tall digger.',
        'Stop at the red light. Go at the green light!',
        'The dump truck tips its load. Down come the rocks!',
        'The dump truck rolls back to the garage. Great driving, {{name}}!',
      ], icons: ['dump-truck', 'dump-truck', 'bus', 'traffic-light', 'dump-truck', 'dump-truck'] },
      problems: [
        add('1 car is in the garage. 1 more car drives in. How many cars?', 1, 1, 'car'),
        add('{{name}} sees 2 trucks on the road and then 2 more. How many trucks?', 2, 2, 'dump-truck'),
        add('There are 3 cones on the road. A worker puts down 1 more. How many cones?', 3, 1, 'cone'),
        cmp('{{name}} has 1 bus. A friend has 3 buses. Write the bigger number.', 1, 3, 'bus'),
      ],
      sentence: 'I see a big truck.',
      activities: [
        'Write each letter of {{name}}\'s name on a toy car with a sticky note. Park the cars in order to spell the name, then mix them up and park them again.',
        'Count trucks and cars on a walk or a drive. Stop at 3 and start over.',
      ],
    },
    kindergarten: {
      story: { title: '{{name}} and the Red Van', pages: [
        '{{name}} has a red van and a big dump truck.',
        'The van can go up a hill past a red cone. Zip, zip!',
        'A dump truck is in the mud. It can not get up.',
        '{{name}} and the van get a tow truck. Tug, tug!',
        'Up it gets! The dump truck is not stuck.',
        'The van and the truck nap in the garage.',
      ], icons: ['dump-truck', 'cone', 'dump-truck', 'tow-truck', 'dump-truck', 'dump-truck'] },
      problems: [
        add('{{name}} parks 3 cars and then 2 more cars. How many cars in all?', 3, 2, 'car'),
        sub('6 cones are on the road. A truck picks up 2. How many cones are left?', 6, 2, 'cone'),
        add('4 trucks wait at the light. 1 more truck pulls up. How many trucks?', 4, 1, 'dump-truck'),
        sub('5 buses are parked at school. 3 drive away. How many buses are still parked?', 5, 3, 'bus'),
        cmp('{{name}} sees 7 cars. Dad sees 5 cars. Write the bigger number.', 7, 5, 'car'),
      ],
      sentence: 'A van and a bus can go.',
      activities: [
        'Make a "name road" with painter\'s tape on the floor, one letter of {{name}}\'s name per stop. Drive a toy truck along it, saying each letter.',
        'Play red light, green light. On green, {{name}} says a word that goes with "a" (a car, a bus); on red, stop and freeze.',
      ],
    },
  },

  unicorns: {
    'pre-k': {
      story: { title: '{{name}} and the Little Unicorn', pages: [
        'Over the rainbow lives one little unicorn.',
        'The unicorn has one shiny horn and a soft, curly mane.',
        'One day it meets {{name}}. "What a lovely name," says the unicorn.',
        'They hop from cloud to cloud and find one sparkly gem.',
        'The unicorn draws {{name}}\'s name in the sky with a rainbow.',
        'Then they curl up under the stars for a nap. Sweet dreams!',
      ], icons: ['unicorn', 'unicorn', 'unicorn', 'cloud', 'unicorn', 'star'] },
      problems: [
        add('The unicorn finds 1 gem, then 1 more. How many gems?', 1, 1, 'gem'),
        add('2 hearts float by. Then 1 more heart floats by. How many hearts?', 2, 1, 'heart'),
        add('{{name}} picks 2 flowers and then 2 more. How many flowers?', 2, 2, 'flower'),
        cmp('{{name}} sees 4 stars. The unicorn sees 2 stars. Write the bigger number.', 4, 2, 'star'),
      ],
      sentence: 'I love my unicorn.',
      activities: [
        'Write {{name}}\'s name in big letters and let them decorate each letter with stickers or glitter glue, saying the letter name each time.',
        'Make a "rainbow count": line up 1 red, then 2 orange, then 3 yellow blocks or crayons and count each color.',
      ],
    },
    kindergarten: {
      story: { title: '{{name}} and the Pink Unicorn', pages: [
        'A pink unicorn sat on a cloud.',
        'It had a gem and a red hat.',
        'The unicorn and {{name}} hop and run.',
        'Oh no! The gem fell in the mud.',
        '{{name}} dug and dug and got the gem.',
        'The unicorn and {{name}} hug. It is a fun day!',
      ], icons: ['unicorn', 'gem', 'unicorn', 'gem', 'gem', 'unicorn'] },
      problems: [
        add('{{name}} has 3 gems. The unicorn gives 2 more. How many gems now?', 3, 2, 'gem'),
        sub('The unicorn has 6 hearts. She gives 2 to {{name}}. How many hearts does the unicorn have left?', 6, 2, 'heart'),
        add('4 flowers grow by the rainbow and 3 more pop up. How many flowers?', 4, 3, 'flower'),
        sub('The unicorn has 5 stars. It gives 1 star to {{name}}. How many stars does it have left?', 5, 1, 'star'),
        cmp('{{name}} counts 8 hearts. A friend counts 6. Write the bigger number.', 8, 6, 'heart'),
      ],
      sentence: 'A unicorn and a gem.',
      activities: [
        'Hide paper gems around the room, each with one letter of {{name}}\'s name. Collect them all and put the name together.',
        'Read a favorite book together and give a "unicorn sparkle" (wiggly fingers) every time you reach a or and.',
      ],
    },
  },

  ocean: {
    'pre-k': {
      story: { title: '{{name}} Under the Sea', pages: [
        '{{name}} puts on a mask and swims down, down, down past the fish.',
        'Hello, little crab! The crab waves one big claw.',
        'One whale sings a long, low song.',
        'One octopus wiggles all of its arms at once.',
        'The little crab writes {{name}}\'s name in the sand.',
        'Swish! A sea turtle gives {{name}} a ride home for supper.',
      ], icons: ['fish', 'crab', 'whale', 'octopus', 'crab', 'turtle'] },
      problems: [
        add('1 fish swims by. Then 1 more fish swims by. How many fish?', 1, 1, 'fish'),
        add('The crab finds 2 shells and then 1 more. How many shells?', 2, 1, 'shell'),
        add('{{name}} sees 3 starfish and then 1 more. How many starfish?', 3, 1, 'starfish'),
        cmp('{{name}} counts 3 fish. The crab counts 1 fish. Write the bigger number.', 3, 1, 'fish'),
      ],
      sentence: 'I see a fish.',
      activities: [
        'Write the letters of {{name}}\'s name on paper fish. "Catch" them with a spoon from a pretend pond and line them up to spell the name.',
        'Fill a sink or tub and count cups as you pour: 1 cup, 2 cups, 3 cups.',
      ],
    },
    kindergarten: {
      story: { title: '{{name}} and the Crab', pages: [
        '{{name}} sat in the hot sand and got a shell.',
        'A red crab ran up to {{name}}.',
        'The crab had a big shell and a net.',
        '"Can I dig?" said the crab. "Yes, you can!"',
        'The crab and {{name}} dig a big pit.',
        'A wet wave got the crab and {{name}}. Splash! It is fun.',
      ], icons: ['shell', 'crab', 'crab', 'crab', 'crab', 'crab'] },
      problems: [
        add('{{name}} has 4 shells and finds 2 more. How many shells in all?', 4, 2, 'shell'),
        sub('7 fish swim by the rock. 3 swim away. How many fish are left?', 7, 3, 'fish'),
        add('There are 2 crabs on the sand and 3 more come. How many crabs?', 2, 3, 'crab'),
        sub('A net has 5 starfish. 1 falls back in the water. How many are in the net?', 5, 1, 'starfish'),
        cmp('{{name}} counts 2 octopuses. The crab counts 8. Write the bigger number.', 2, 8, 'octopus'),
      ],
      sentence: 'A crab and a fish.',
      activities: [
        'Make "name shells": write one letter of {{name}}\'s name on each of a few paper or real shells and line them up in order.',
        'Read a book about the sea and have {{name}} snap fingers like crab claws on every a and and.',
      ],
    },
  },

  space: {
    'pre-k': {
      story: { title: '{{name}} Goes to Space', pages: [
        '{{name}} climbs into one shiny rocket. 3, 2, 1, blast off!',
        'Up past the clouds. Up past the birds. Up to the stars!',
        'A little alien waves hello. "Who are you?"',
        '"I am {{name}}," says {{name}}, and spells it for the alien.',
        'They float around one big planet with a ring.',
        'Time to fly home. Good night, moon. Good night, little alien.',
      ], icons: ['rocket', 'star', 'alien', 'alien', 'planet', 'moon'] },
      problems: [
        add('1 rocket blasts off. Then 1 more rocket blasts off. How many rockets?', 1, 1, 'rocket'),
        add('{{name}} sees 2 stars and then 2 more stars. How many stars?', 2, 2, 'star'),
        add('The alien finds 3 moons and then 1 more. How many moons?', 3, 1, 'moon'),
        cmp('{{name}} counts 1 planet. The alien counts 4 planets. Write the bigger number.', 1, 4, 'planet'),
      ],
      sentence: 'I see a rocket.',
      activities: [
        'Do a countdown before every snack or bath this week: 3, 2, 1, blast off!',
        'Tape the letters of {{name}}\'s name to the ceiling or a wall like stars. Shine a flashlight on each one and say its name.',
      ],
    },
    kindergarten: {
      story: { title: '{{name}} in the Big Rocket', pages: [
        '{{name}} got in a big red rocket.',
        'Up, up, up the rocket went! It is not a bus. It is a jet in space.',
        'A little alien sat on the moon.',
        'The alien had a map and a hat.',
        '{{name}} and the alien zip to the sun. It is hot!',
        'Back in the rocket, {{name}} had a nap.',
      ], icons: ['rocket', 'rocket', 'alien', 'alien', 'alien', 'rocket'] },
      problems: [
        add('{{name}} sees 5 stars and then 2 more. How many stars in all?', 5, 2, 'star'),
        sub('There are 6 rockets on the pad. 4 blast off. How many rockets are left?', 6, 4, 'rocket'),
        add('An alien has 3 moons. It finds 3 more. How many moons?', 3, 3, 'moon'),
        sub('8 aliens wave from the moon. 1 alien hops into a rocket. How many aliens are still on the moon?', 8, 1, 'alien'),
        cmp('{{name}} sees 4 rockets. The alien sees 7 rockets. Write the bigger number.', 4, 7, 'rocket'),
      ],
      sentence: 'A rocket and a moon.',
      activities: [
        'Count down from 10 to 0 before blasting off a paper rocket. On 0, {{name}} says their name instead of "blast off."',
        'Make an "a and and" star chart: each time {{name}} spots one of the words in a book, add a sticker star.',
      ],
    },
  },

  farm: {
    'pre-k': {
      story: { title: '{{name}} on the Farm', pages: [
        'Cluck, cluck! A hen wakes {{name}} up on the farm.',
        'One cow says moo. One pig says oink.',
        'One hen lays one brown egg. {{name}} holds it carefully.',
        '{{name}} rides on the big tractor with the farmer.',
        'The farmer paints {{name}}\'s name on the red barn door.',
        'Night falls. The animals sleep in the barn. Good night, farm!',
      ], icons: ['hen', 'cow', 'hen', 'tractor', 'barn', 'barn'] },
      problems: [
        add('1 pig rolls in the mud. Then 1 more pig rolls in. How many pigs?', 1, 1, 'pig'),
        add('2 hens peck in the yard. 1 more hen comes out. How many hens?', 2, 1, 'hen'),
        add('{{name}} sees 2 ducks in the pond and 2 more on the grass. How many ducks?', 2, 2, 'duck'),
        cmp('{{name}} sees 3 cows. The little pig sees 1 cow. Write the bigger number.', 3, 1, 'cow'),
      ],
      sentence: 'I see a pig.',
      activities: [
        'Make animal sounds for each letter of {{name}}\'s name: point to a letter, say its name, then moo, oink or quack.',
        'Count eggs in the carton at breakfast. Take one out and count again.',
      ],
    },
    kindergarten: {
      story: { title: '{{name}} and the Big Pig', pages: [
        'A big pig sat in the mud.',
        'A red hen and a cat ran to the pig.',
        '"Get up, pig!" said the hen. The pig did not get up.',
        '{{name}} had a bun and a cup of milk from the cow.',
        'The pig got up fast! It ran to {{name}}.',
        '{{name}} fed the pig. Yum, yum! The pig is glad.',
      ], icons: ['pig', 'hen', 'pig', 'cow', 'pig', 'pig'] },
      problems: [
        add('{{name}} feeds 3 hens and then 4 more hens. How many hens in all?', 3, 4, 'hen'),
        sub('There are 5 pigs in the mud. 2 pigs get out. How many pigs are still in the mud?', 5, 2, 'pig'),
        add('2 cows and 2 more cows are in the barn. How many cows?', 2, 2, 'cow'),
        sub('9 ducks swim in the pond. 3 ducks waddle away. How many ducks are left?', 9, 3, 'duck'),
        cmp('{{name}} counts 6 sheep. The farmer counts 4 sheep. Write the bigger number.', 6, 4, 'sheep'),
      ],
      sentence: 'A pig and a hen.',
      activities: [
        'Line up toy animals (or pictures) in a row and give each one a letter of {{name}}\'s name. Read the name from the barn to the pond.',
        'Find a and and on a cereal box or a book about animals. {{name}} oinks for a and moos for and.',
      ],
    },
  },

  bugs: {
    'pre-k': {
      story: { title: '{{name}} and the Little Ladybug', pages: [
        '{{name}} takes a magnifying glass to the garden and finds one busy ant.',
        'There on one green leaf sits one little ladybug.',
        'The ladybug has spots. {{name}} counts them, one by one.',
        'A bee buzzes by. A butterfly flutters past.',
        'The ladybug walks across {{name}}\'s hand. It tickles!',
        'Bye, little ladybug. See you tomorrow!',
      ], icons: ['ant', 'leaf', 'ladybug', 'bee', 'ladybug', 'ladybug'] },
      problems: [
        add('1 ladybug sits on a leaf. 1 more lands. How many ladybugs?', 1, 1, 'ladybug'),
        add('{{name}} sees 2 bees and then 2 more bees. How many bees?', 2, 2, 'bee'),
        add('There are 3 leaves on the ground. 1 more leaf falls. How many leaves?', 3, 1, 'leaf'),
        cmp('{{name}} finds 2 snails. A friend finds 1 snail. Write the bigger number.', 2, 1, 'snail'),
      ],
      sentence: 'I see a bug.',
      activities: [
        'Go on a bug hunt outside or in a book. Count the bugs you find, up to 3.',
        'Make a "name caterpillar": one paper circle per letter of {{name}}\'s name, glued in a row with a face at the front.',
      ],
    },
    kindergarten: {
      story: { title: '{{name}} and the Bug', pages: [
        'A red bug sat on a big leaf.',
        'The bug had six legs and a lot of spots.',
        '{{name}} sat by a snail and got a net.',
        'Hop! The bug hid in a web. Uh oh!',
        'A spider and a bug? No! The spider is not mad.',
        '{{name}} and the bug sit in the sun. It is fun.',
      ], icons: ['ladybug', 'ladybug', 'snail', 'ladybug', 'spider', 'ladybug'] },
      problems: [
        add('{{name}} sees 4 ants and then 3 more ants. How many ants in all?', 4, 3, 'ant'),
        sub('There are 6 bees by the flower. 2 fly away. How many bees are left?', 6, 2, 'bee'),
        add('3 ladybugs and 2 more ladybugs sit on a leaf. How many ladybugs?', 3, 2, 'ladybug'),
        sub('8 spiders sit on a web. 4 crawl away. How many spiders are left?', 8, 4, 'spider'),
        cmp('{{name}} sees 5 butterflies. A friend sees 3. Write the bigger number.', 5, 3, 'butterfly'),
      ],
      sentence: 'A bug and a leaf.',
      activities: [
        'Make a bug out of play dough for each letter of {{name}}\'s name, then line the bugs up to spell it.',
        'Hunt for a and and on a page of a bug book. Cover each one with a dried bean "bug."',
      ],
    },
  },

  castles: {
    'pre-k': {
      story: { title: '{{name}} at the Castle', pages: [
        'At the top of the hill stands one tall castle.',
        '{{name}} knocks on the big castle gate. Knock, knock!',
        'Out peeks one little dragon. It is shy, and very friendly.',
        'The dragon gives {{name}} one shiny crown.',
        'The princess cheers: "Hooray for {{name}}!"',
        'They have a party in the castle, then rest by the warm fire.',
      ], icons: ['castle', 'castle', 'dragon', 'dragon', 'princess', 'castle'] },
      problems: [
        add('1 crown sits on the table. 1 more crown is put down. How many crowns?', 1, 1, 'crown'),
        add('The dragon has 2 rings and finds 2 more. How many rings?', 2, 2, 'ring'),
        add('3 frogs sit by the castle pond. 1 more hops over. How many frogs?', 3, 1, 'frog'),
        cmp('{{name}} has 1 shield. The knight has 2 shields. Write the bigger number.', 1, 2, 'shield'),
      ],
      sentence: 'I see a castle.',
      activities: [
        'Build a block castle with a "name flag": a paper flag with {{name}}\'s name on top. Say the letters as you build.',
        'Have a little royal parade: march around the room 1 time, 2 times, then 3 times.',
      ],
    },
    kindergarten: {
      story: { title: '{{name}} and the Little Dragon', pages: [
        'A little dragon sat on top of a big castle.',
        'It had a red hat and a gold ring.',
        '{{name}} ran up and up the castle steps.',
        '"Can I pet you?" said {{name}}. The dragon did a nod.',
        'The dragon and {{name}} sat in the sun.',
        'The dragon is not sad. It is a fun day at the castle.',
      ], icons: ['dragon', 'ring', 'castle', 'dragon', 'dragon', 'dragon'] },
      problems: [
        add('{{name}} has 3 rings and finds 3 more. How many rings in all?', 3, 3, 'ring'),
        sub('There are 7 frogs by the castle. 2 hop away. How many frogs are left?', 7, 2, 'frog'),
        add('5 crowns are on a shelf and 1 more crown is put there. How many crowns?', 5, 1, 'crown'),
        sub('4 carriages wait at the castle. 1 drives away. How many carriages are left?', 4, 1, 'carriage'),
        cmp('{{name}} counts 6 castles in a book. The dragon counts 9. Write the bigger number.', 6, 9, 'castle'),
      ],
      sentence: 'A dragon and a castle.',
      activities: [
        'Make a crown from paper and write {{name}}\'s name across the front. Wear it while reading this week\'s story book.',
        'Read a fairy tale together. Each time you reach a or and, {{name}} gives a royal wave.',
      ],
    },
  },

  trains: {
    'pre-k': {
      story: { title: '{{name}} Rides the Train', pages: [
        'Toot, toot! Here comes one little red engine.',
        '{{name}} has one ticket. Punch! All aboard!',
        'Chugga, chugga. The train goes up a hill and down a hill.',
        'Into one dark tunnel. Out into the sun!',
        'The engine toots {{name}}\'s name: one toot for each letter.',
        'Last stop. Thank you, little engine. See you tomorrow!',
      ], icons: ['engine', 'ticket', 'engine', 'tunnel', 'engine', 'engine'] },
      problems: [
        add('1 train car is on the track. 1 more car hooks on. How many train cars?', 1, 1, 'passenger-car'),
        add('{{name}} has 2 tickets and gets 1 more. How many tickets?', 2, 1, 'ticket'),
        add('2 engines and 2 more engines wait at the station. How many engines?', 2, 2, 'engine'),
        cmp('The red train has 3 train cars. The blue train has 1 train car. Write the bigger number.', 3, 1, 'passenger-car'),
      ],
      sentence: 'I see a train.',
      activities: [
        'Make a "name train" of chairs or pillows, one for each letter in {{name}}\'s name. Ride along and say each letter.',
        'Toot the train whistle 1, 2 or 3 times, and {{name}} counts the toots.',
      ],
    },
    kindergarten: {
      story: { title: '{{name}} and the Red Engine', pages: [
        'A red engine sat on the track.',
        '{{name}} got a ticket and sat in the cab.',
        'Toot, toot! Up the hill the engine ran.',
        'The engine and {{name}} went in a tunnel. It is dim!',
        'Out in the sun, the engine got to a big stop.',
        '{{name}} had a fun trip on a red train.',
      ], icons: ['engine', 'ticket', 'engine', 'engine', 'engine', 'engine'] },
      problems: [
        add('A train has 4 train cars. 3 more train cars hook on. How many train cars in all?', 4, 3, 'passenger-car'),
        sub('There are 8 tickets. {{name}} gives away 3. How many tickets are left?', 8, 3, 'ticket'),
        add('2 engines and 2 more engines are at the station. How many engines?', 2, 2, 'engine'),
        sub('6 boxcars wait on the track. 4 go away. How many boxcars are left?', 6, 4, 'boxcar'),
        cmp('The long train has 9 train cars. The short train has 5. Write the bigger number.', 9, 5, 'passenger-car'),
      ],
      sentence: 'A train and a track.',
      activities: [
        'Build a train from toy cars or boxes, one car per letter of {{name}}\'s name. Read the name from engine to caboose.',
        'Look for a and and in a train book. {{name}} says "toot" each time they find one.',
      ],
    },
  },

  sports: {
    'pre-k': {
      story: { title: '{{name}} Plays Ball', pages: [
        '{{name}} laces up one pair of sneakers. Ready to play!',
        'Kick! The soccer ball rolls across the grass.',
        'Bounce, bounce, bounce goes the basketball.',
        'Swing! The bat hits the ball. Run, {{name}}, run!',
        'The team cheers by the goal: "Go, {{name}}!"',
        '{{name}} gets one shiny medal for trying so hard.',
      ], icons: ['sneaker', 'soccer-ball', 'basketball', 'bat-and-ball', 'goal', 'medal'] },
      problems: [
        add('1 soccer ball is in the goal. 1 more goes in. How many soccer balls?', 1, 1, 'soccer-ball'),
        add('{{name}} has 2 basketballs and finds 1 more. How many basketballs?', 2, 1, 'basketball'),
        add('2 sneakers are by the door. 2 more sneakers are by the bed. How many sneakers?', 2, 2, 'sneaker'),
        cmp('{{name}} has 3 medals. A friend has 2 medals. Write the bigger number.', 3, 2, 'medal'),
      ],
      sentence: 'I can kick a ball.',
      activities: [
        'Tape the letters of {{name}}\'s name to a wall. Roll a soft ball at a letter and say its name when you hit it.',
        'Count kicks, bounces or jumps: 1, 2, 3, then start over.',
      ],
    },
    kindergarten: {
      story: { title: '{{name}} Can Hit', pages: [
        '{{name}} has a bat and a cap.',
        'Hit the ball with the bat, {{name}}! Bam! It went up.',
        '{{name}} ran in red sneakers. The team ran too.',
        'It is a win! {{name}} got a medal.',
        'The team got a big trophy.',
        'The team sat by the trophy and had a snack.',
      ], icons: ['bat-and-ball', 'bat-and-ball', 'sneaker', 'medal', 'trophy', 'trophy'] },
      problems: [
        add('{{name}} kicks 3 soccer balls into the goal, then 2 more. How many soccer balls in all?', 3, 2, 'soccer-ball'),
        sub('There are 7 basketballs. 3 roll away. How many basketballs are left?', 7, 3, 'basketball'),
        add('The team has 4 medals and wins 4 more. How many medals?', 4, 4, 'medal'),
        sub('6 sneakers are by the door. {{name}} puts on 2. How many are left by the door?', 6, 2, 'sneaker'),
        cmp('Team red has 5 trophies. Team blue has 8. Write the bigger number.', 5, 8, 'trophy'),
      ],
      sentence: 'A bat and a ball.',
      activities: [
        'Play "letter toss": write the letters of {{name}}\'s name on paper plates, then toss a beanbag onto each one in order.',
        'Read a page together and do one jumping jack for every a and every and.',
      ],
    },
  },

  pets: {
    'pre-k': {
      story: { title: '{{name}} and the Little Pup', pages: [
        'Woof! One little pup wags its tail at {{name}}.',
        '{{name}} fills one bowl with food and one bowl with water.',
        'The pup chases one ball of yarn. The kitten wants a turn!',
        '{{name}} makes a name tag. It says the pup is {{name}}\'s best friend.',
        'The pup and {{name}} walk around the block, one step at a time.',
        'Snuggle time. The pup falls asleep on {{name}}\'s lap.',
      ], icons: ['puppy', 'food-bowl', 'puppy', 'puppy', 'puppy', 'puppy'] },
      problems: [
        add('1 puppy sits on the rug. 1 more puppy runs over. How many puppies?', 1, 1, 'puppy'),
        add('{{name}} sees 2 kittens and then 1 more kitten. How many kittens?', 2, 1, 'kitten'),
        add('2 goldfish swim in a bowl. 2 more are added. How many goldfish?', 2, 2, 'goldfish'),
        cmp('{{name}} has 1 bunny. A friend has 3 bunnies. Write the bigger number.', 1, 3, 'bunny'),
      ],
      sentence: 'I love my pup.',
      activities: [
        'Make a pretend pet collar from paper with {{name}}\'s name on it, and say each letter as you color it.',
        'Count pet treats (or crackers) into a bowl: 1, 2, 3. Then take them out one at a time.',
      ],
    },
    kindergarten: {
      story: { title: '{{name}} and the Pup', pages: [
        '{{name}} has a pup and a cat.',
        'The pup can sit. The cat can nap.',
        'The pup got the cat\'s red yarn!',
        'The cat ran and the pup ran. Zig, zag!',
        '{{name}} fed the pup and the cat.',
        'Then the pup and the cat had a nap in the sun.',
      ], icons: ['puppy', 'puppy', 'puppy', 'kitten', 'puppy', 'puppy'] },
      problems: [
        add('{{name}} has 3 fish and gets 2 more. How many fish in all?', 3, 2, 'goldfish'),
        sub('There are 6 food bowls. The pup licks 2 clean, and they go away. How many bowls are left?', 6, 2, 'food-bowl'),
        add('4 kittens and 2 more kittens nap on the bed. How many kittens?', 4, 2, 'kitten'),
        sub('7 balls of yarn sit in a basket. The cat takes 3. How many are left?', 7, 3, 'yarn'),
        cmp('One cage has 5 hamsters. Another cage has 9. Write the bigger number.', 5, 9, 'hamster'),
      ],
      sentence: 'A pup and a cat.',
      activities: [
        'Pretend to be a vet and make a chart for a stuffed animal: {{name}} writes their name as "Doctor" at the top.',
        'Read a pet book together and have {{name}} bark for each a and meow for each and.',
      ],
    },
  },

  jungle: {
    'pre-k': {
      story: { title: '{{name}} in the Jungle', pages: [
        'Swing, swing! One little monkey swings down to say hi to {{name}}.',
        'One lion gives one big, sleepy yawn.',
        'One elephant sprays water. Splash!',
        'One giraffe stretches up high to eat the leaves.',
        'The parrot learns to say "{{name}}!" It says it again and again.',
        'The monkey shares a banana. What a jungle day!',
      ], icons: ['monkey', 'lion', 'elephant', 'giraffe', 'parrot', 'monkey'] },
      problems: [
        add('1 monkey is in the tree. 1 more monkey climbs up. How many monkeys?', 1, 1, 'monkey'),
        add('The monkey has 2 bananas and finds 1 more. How many bananas?', 2, 1, 'bananas'),
        add('2 parrots and 2 more parrots sit on a branch. How many parrots?', 2, 2, 'parrot'),
        cmp('{{name}} sees 3 zebras. The monkey sees 1 zebra. Write the bigger number.', 3, 1, 'zebra'),
      ],
      sentence: 'I see a lion.',
      activities: [
        'Move like jungle animals while you spell {{name}}\'s name: stomp like an elephant for one letter, hop like a monkey for the next.',
        'Count bananas at the store or at home. Count the bunch, then count again after one is eaten.',
      ],
    },
    kindergarten: {
      story: { title: '{{name}} and the Monkey', pages: [
        'A little monkey sat up on a big vine.',
        'The monkey had a bun and a red hat.',
        '{{name}} and the monkey hop and run.',
        'A big hippo sat in the mud. It had a nap.',
        'The monkey and {{name}} dig in the mud. Yuck!',
        'The hippo got up and gave them a big hug.',
      ], icons: ['monkey', 'monkey', 'monkey', 'hippo', 'monkey', 'hippo'] },
      problems: [
        add('{{name}} sees 4 monkeys and then 3 more. How many monkeys in all?', 4, 3, 'monkey'),
        sub('A bunch has 6 bananas. The monkey eats 2. How many bananas are left?', 6, 2, 'bananas'),
        add('5 parrots sit on a branch and 1 more lands. How many parrots?', 5, 1, 'parrot'),
        sub('There are 7 zebras by the water. 4 run off. How many zebras are left?', 7, 4, 'zebra'),
        cmp('{{name}} sees 3 lions. The monkey sees 1 lion. Write the bigger number.', 3, 1, 'lion'),
      ],
      sentence: 'A lion and a hippo.',
      activities: [
        'Make a paper vine with one leaf for each letter of {{name}}\'s name. Hang it up and have a toy monkey "climb" it letter by letter.',
        'Read a jungle book together. {{name}} roars for every a and every and.',
      ],
    },
  },
};

// ---------- Picture book stories (scene paths) ----------

// ---------- The week's teaching line ({W}) ----------

/** Words whose FIRST SOUND is the sound each letter is taught with (short vowels, hard c and g, no ch, sh, th, wh,
 *  kn or ph). X has none a child would hear, so x is taught as an ending sound ("Box ends with x!"). */
const SOUND_WORDS: Record<string, string[]> = {
  a: ['ant', 'apple', 'ax', 'alligator'], b: ['bus', 'bag', 'ball', 'bed'], c: ['cat', 'cup', 'cap', 'cow'], d: ['dog', 'dot', 'duck', 'dig'],
  e: ['egg', 'elf', 'elephant', 'end'], f: ['fan', 'fox', 'fish', 'fun'], g: ['gum', 'goat', 'gift', 'gate'], h: ['hat', 'hen', 'hop', 'hill'],
  i: ['inch', 'igloo', 'insect', 'in'], j: ['jet', 'jam', 'jump', 'jug'], k: ['kit', 'kite', 'king', 'kick'], l: ['log', 'lid', 'leaf', 'lamp'],
  m: ['map', 'mug', 'moon', 'mud'], n: ['net', 'nut', 'nest', 'nap'], o: ['ox', 'octopus', 'otter', 'on'], p: ['pig', 'pan', 'pot', 'pup'],
  q: ['queen', 'quilt', 'quack'], r: ['rug', 'rock', 'red', 'run'], s: ['sun', 'sock', 'sand', 'six'], t: ['tent', 'tub', 'top', 'ten'],
  u: ['up', 'umbrella', 'under', 'us'], v: ['van', 'vest', 'vine', 'vet'], w: ['web', 'wig', 'wet', 'wagon'], y: ['yak', 'yarn', 'yes', 'yard'],
  z: ['zebra', 'zip', 'zoo', 'zigzag'], x: ['box', 'fox', 'six', 'wax'],
};
/** Short vowels can't be told from spelling alone, so a story word only stands in for a vowel when it is here. */
const SHORT_VOWEL_OK = new Set(['ant', 'ants', 'apple', 'apples', 'ax', 'egg', 'eggs', 'elf', 'end', 'inch', 'in', 'ox', 'on', 'off', 'up', 'under', 'umbrella', 'octopus', 'otter', 'insect', 'igloo']);
/** True when a word starts with the sound the letter is taught with. */
export function startsWithSound(letter: string, word: string): boolean {
  const w = word.toLowerCase();
  if (letter === 'x') return w.endsWith('x');
  if (!w.startsWith(letter)) return false;
  if ('aeiou'.includes(letter)) return SHORT_VOWEL_OK.has(w) || (SOUND_WORDS[letter] ?? []).includes(w);
  if (/^(ch|sh|th|wh|kn|ph|wr)/.test(w)) return false;
  if ((letter === 'c' || letter === 'g') && /^[cg][eiy]/.test(w)) return false;
  return true;
}
/** "S is for sun" with a thing from the story when one fits the sound, else a plain word (never a cast name). */
function letterPhrase(l: string, pages: string[], theme: ThemeId, scenes: string[], castNames: string[] = []): string {
  const seen = new Set(pages.join(' ').toLowerCase().match(/[a-z]+/g) ?? []);
  const things = scenes.flatMap((id) => SCENES[theme].scenes.find((s) => s.id === id)?.props ?? []).filter((p) => /^[a-z]{3,8}$/.test(p) && seen.has(p));
  const word = things.find((t) => startsWithSound(l, t) && !castNames.includes(t)) ?? (SOUND_WORDS[l] ?? [l]).find((x) => !castNames.includes(x)) ?? l;
  return l === 'x' ? `${cap1(word)} ends with x` : `${l.toUpperCase()} is for ${word}`;
}
/** A tiny quote for each sight word, true on any page (no "you": stories never speak to the reader). */
const SIGHT_SAY: Record<string, string> = {
  a: 'What a day!', and: 'Hop and clap!', away: 'Away we go!', big: 'That is big!', blue: 'I like blue!', can: 'We can do it!', come: 'Come and see!',
  down: 'Sit down!', find: 'We can find it!', for: 'This is for me!', funny: 'That is funny!', go: 'Go, go, go!', help: 'We can help!', here: 'Look here!',
  I: 'I can do it!', in: 'Hop in!', is: 'It is fun!', it: 'We did it!', jump: 'Jump, jump!', little: 'A little one!', look: 'Look, look!', make: 'Make a wish!',
  me: 'Look at me!', my: 'My, oh my!', not: 'Not yet!', one: 'One more time!', play: "Let's play!", red: 'Red is fun!', run: 'Run, run, run!',
  said: 'Hi!', see: 'I see it!', the: 'The best day!', three: 'One, two, three!', to: 'Off to play!', two: 'One, two!', up: 'Up, up, up!', we: 'We did it!',
  where: 'Where to now?', yellow: 'Yellow is fun!', all: 'We all did it!', am: 'I am so glad!', are: 'We are friends!', at: 'Look at that!', ate: 'We ate a snack!',
  be: 'Be happy!', black: 'Black and white!', brown: 'Brown is fun!', but: 'Slow, but sure!', came: 'We came to play!', did: 'We did it!', do: 'We can do it!',
  eat: 'Time to eat!', four: 'One, two, three, four!', get: 'Get set, go!', good: 'Good job!', have: 'We have fun!', he: 'He is my pal!', into: 'Hop into bed!',
  like: 'I like it!', must: 'We must try!', new: 'A new day!', no: 'Oh, no!', now: 'Now we go!', on: 'Hop on!', our: 'Our best day!', out: 'Look out!',
  please: 'Yes, please!', pretty: 'So pretty!', ran: 'We ran and ran!', ride: 'Ride on!', saw: 'I saw it!', say: 'Say hi!', she: 'She is my pal!', so: 'So much fun!',
};
const wordsIn = (t: string) => new Set((t.replace(/\{\{name\}\}/g, ' ').toLowerCase().match(/[a-z']+/g) ?? []));

/** A short exclamation for a vowel review week, so the story has a word that starts with the vowel. */
const VOWEL_SAY: Record<string, string> = { a: 'Away we go!', e: 'Every one!', i: 'In we go!', o: 'On we go!', u: 'Up, up, up!' };

/**
 * Puts the week's teaching into a template story and returns the new pages. The teaching line goes on the {W} page as
 * speech (true of any picture): the child says it, or, when that page already names the child, a cast member who is
 * in the picture says it, so the child is never named twice on one page. Letter weeks use words whose first sound is
 * the letter's sound and name every letter of a review week; word family weeks chant the family. The week's sight
 * words the story is missing are added as tiny exclamations ("Look here!"), on the {W} page while it has room and then
 * on other pages that have room. Every page keeps to PAGE_RULES, the same rule the AI is held to.
 */
function placeTeaching(level: Level, w: Week, pw: ProgramWeek, raw: string[], scenes: string[], at: number): string[] {
  const pages = raw.map((p) => p.replace(/\s*\{W\}/, '').trim());
  const fits = (t: string) => !pageLengthProblem(level, t);
  const castNames = SCENES[pw.theme].cast.map((c) => c.name.toLowerCase().replace(/^(princess|sir) /, ''));
  const speakerAt = (i: number): { who: string; it: boolean } | null => {
    if (!pages[i].includes('{{name}}')) return { who: '{{name}}', it: false };
    const c = SCENES[pw.theme].scenes.find((s) => s.id === scenes[i])?.cast[0];
    if (!c) return null;
    const member = SCENES[pw.theme].cast.find((x) => x.name === c)!;
    return { who: c.replace(/^(Princess|Sir) /, ''), it: member.pronoun === 'it' };
  };
  const story = () => wordsIn(pages.join(' '));
  // The teaching quote, as short pieces (each one a sentence inside the quote).
  const pieces: string[] = [];
  let sing = false;
  if (w.kind === 'name') {
    const sp = speakerAt(at);
    const line = sp?.who === '{{name}}' ? 'Hip, hip, hooray for {{name}}!' : sp ? `${sp.who} cheers, "Hip, hip, hooray!"` : 'Hip, hip, hooray!';
    if (fits(`${pages[at]} ${line}`)) pages[at] = `${pages[at]} ${line}`;
  } else if (w.kind === 'family' || w.kind === 'vowel-review') {
    const fams = w.kind === 'family' ? [w.family!] : (w.families ?? []);
    const list = fams.length === 1 ? (FAMILIES[fams[0]] ?? []).slice(0, 3) : fams.slice(0, 4).map((f) => (FAMILIES[f] ?? [])[0]).filter(Boolean);
    if (list.length) { pieces.push(`${list.map((x, i) => (i ? x : cap1(x))).join(', ')}!`); sing = true; }
    if (w.kind === 'vowel-review' && w.letters[0] && VOWEL_SAY[w.letters[0]]) pieces.push(VOWEL_SAY[w.letters[0]]);
  } else {
    const ls = (pw.extraReview ? reviewLetters(pw) : w.letters).filter((l) => /^[a-z]$/.test(l));
    const word = (l: string) => letterPhrase(l, raw, pw.theme, scenes, castNames);
    if (ls.length > 2) {
      // A review week names every letter, then a word for each: "S, A, T! Sun, ant, tent!"
      pieces.push(`${ls.map((l) => l.toUpperCase()).join(', ')}!`, `${ls.map((l, i) => { const x = word(l).split(' ').pop()!; return i ? x : cap1(x); }).join(', ')}!`);
    } else {
      for (const l of ls) pieces.push(`${word(l)}!`);
    }
  }
  // Sight words the story doesn't use yet, so the week's words are in the book (the AI is held to the same rule).
  const sw = (w.sightWords ?? []).filter((x) => x.toLowerCase() !== 'you');
  const need = Math.ceil((w.sightWords ?? []).length / 2);
  const extra: string[] = [];
  const has = (x: string) => story().has(x.toLowerCase()) || [...pieces, ...extra].some((p) => wordsIn(p).has(x.toLowerCase()));
  for (const x of sw) {
    if (sw.filter(has).length >= need) break;
    if (!has(x) && SIGHT_SAY[x]) extra.push(SIGHT_SAY[x]);
  }
  const verbFor = (sp: { who: string; it: boolean }) => (sw.includes('said') && !story().has('said') ? 'said' : sing && !sp.it ? 'sings' : 'says');
  const quoteLine = (sp: { who: string; it: boolean } | null, ps: string[]) => (sp ? `${sp.who} ${verbFor(sp)}, "${ps.join(' ')}"` : ps.join(' '));
  if (pieces.length || extra.length) {
    // As much as fits on the {W} page: the teaching pieces first, then sight word exclamations.
    const sp = speakerAt(at);
    const all = [...pieces, ...extra];
    let n = all.length;
    while (n > 0 && !fits(`${pages[at]} ${quoteLine(sp, all.slice(0, n))}`)) n--;
    if (n > 0) pages[at] = `${pages[at]} ${quoteLine(sp, all.slice(0, n))}`;
    // The rest go on other pages with room, as tiny exclamations (true of any picture), later pages first.
    for (const piece of all.slice(n)) {
      for (const i of pages.map((_, k) => k).filter((k) => k !== 0).reverse()) {
        if (fits(`${pages[i]} ${piece}`)) { pages[i] = `${pages[i]} ${piece}`; break; }
      }
    }
  }
  return pages.map((p) => p.replace(/\s+/g, ' ').trim());
}

/**
 * The template picture book story for a week, or null when the theme has no ready picture book for the level
 * (then the old little book is used). Paths rotate by week so a child gets a different story each week.
 */
export function sceneStoryFor(theme: ThemeId, level: Level, w: Week | null, pw: ProgramWeek | null, pick = 0): WeekContent['story'] | null {
  const paths = readyPaths(theme, level);
  if (!paths.length) return null;
  const path = paths[((pick % paths.length) + paths.length) % paths.length];
  const text = STORY_TEXTS[theme]?.[path.id];
  if (!text) return null;
  const byScene = new Map(text.pages);
  if (!path.fitted.every((id) => byScene.has(id))) return null;
  // A page whose scene a shorter book drops still has its words in the catalog text; the first page of a trimmed
  // book uses its `intro` form when one is written (it introduces a character the dropped page used to).
  const raw = path.fitted.map((id) => byScene.get(id)!);
  // {W} sits on one page; when that page was trimmed away, it moves to the solve page.
  let at = raw.findIndex((p) => p.includes('{W}'));
  if (at < 0) {
    at = path.fitted.findIndex((id) => SCENES[theme].scenes.find((s) => s.id === id)?.beat === 'solve');
    raw[at] = `${raw[at]} {W}`;
  }
  const pages = w && pw ? placeTeaching(level, w, pw, raw, path.fitted, at) : raw.map((p) => p.replace(/\s*\{W\}/, '').replace(/\s+/g, ' ').trim());
  return { title: text.title, pages, scenes: [...path.fitted], pathId: path.id };
}

/** Free week 1 content for a theme and level (no AI). */
export function freeWeekContent(theme: ThemeId, level: Level): WeekContent {
  const f = FREE[theme][level];
  const nameWeek = PLANS[level].weeks[0];
  const scene = sceneStoryFor(theme, level, nameWeek, { index: 1, level, baseWeek: 1, theme, focus: [] }, 0);
  return {
    source: 'template',
    story: scene ?? f.story,
    wordProblems: f.problems,
    tracingSentence: f.sentence,
    parentNote: { teaches: level === 'pre-k' ? PRE_K_TEACHES : K_TEACHES, why: level === 'pre-k' ? PRE_K_WHY : K_WHY, activities: f.activities },
  };
}

// ---------- Any week: built from theme words and the week's skills ----------

const LETTERS = lettersData as { letter: string; words: string[]; tip: string }[];
const art = (w: string) => (/^(uni|use|eu)/i.test(w) ? 'a' : /^[aeiou]/i.test(w) ? 'an' : 'a');
const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const titleCase = (s: string) => s.split(' ').map((w) => (/^(and|the|a|of|in|on)$/.test(w) ? w : cap1(w))).join(' ');

/** Short decodable words by first letter, for Kindergarten letter-week stories. Nouns only, so "a ___" always reads right. */
const CVC_NOUNS: Record<string, string[]> = {
  s: ['sun', 'sack'], a: ['ant', 'ax'], t: ['tent', 'tub'], i: ['inch', 'igloo'], p: ['pig', 'pan'],
  n: ['net', 'nut'], c: ['cat', 'cup'], k: ['kit', 'kite'], e: ['egg', 'elf'], h: ['hat', 'hen'],
  r: ['rug', 'rock'], m: ['map', 'mug'], d: ['dog', 'dot'], g: ['gum', 'gift'], o: ['ox', 'otter'],
  u: ['umbrella'], l: ['log', 'lid'], f: ['fan', 'fox'], b: ['bus', 'bag'], j: ['jet', 'jam'],
  z: ['zipper', 'zebra'], w: ['web', 'wig'], v: ['van', 'vest'], y: ['yak', 'yarn'], x: ['box', 'fox'], q: ['quilt', 'queen'],
};
const startWords = (l: string) => (LETTERS.find((x) => x.letter === l)?.words ?? []).filter((w) => /^[a-z]+$/.test(w) && w.startsWith(l));
const ofIcon = (n: number, ic: ThemeIcon) => (n === 1 ? ic.one : ic.many);

/** Nouns in each word family, so story sentences make sense ("a cat", never "a sat"). */
const FAMILY_NOUNS: Record<string, string[]> = {
  at: ['cat', 'hat', 'bat', 'mat', 'rat'], an: ['van', 'fan', 'pan', 'man', 'can'], ap: ['cap', 'map'], ag: ['bag', 'tag', 'rag'],
  ig: ['pig', 'wig', 'fig'], it: ['kit'], in: ['fin', 'pin', 'bin', 'tin'], ip: ['lip', 'hip'],
  op: ['mop', 'top'], ot: ['pot', 'dot', 'cot'], og: ['dog', 'log', 'hog'],
  ug: ['bug', 'mug', 'rug', 'jug'], un: ['sun', 'bun'], ut: ['nut', 'hut'],
  en: ['hen', 'pen', 'den'], et: ['jet', 'net', 'pet'], ed: ['bed'],
};

/** One short sentence for each sight word in the plans. {B} is the theme buddy, {N} the child. */
const SIGHT: Record<string, string> = {
  a: '{N} sees a {B}.', and: '{N} and the {B} play.', away: 'A bug ran away and hid.', big: '{N} sees a big hill.',
  blue: 'The sky is big and blue.', can: '"I can do it!" said {N}.', come: '"Come and play!" said {N}.', down: 'They sat down to rest.',
  find: '"I can find it!" said {N}.', for: 'This is for you, {B}.', funny: 'The {B} made a funny face.', go: '"Go, go, go!" said {N}.',
  help: '"Can I help?" said the {B}.', here: '"Here I am!" said the {B}.', I: '"I see you!" said {N}.', in: 'A bug is in the box.',
  is: 'It is a fun day.', it: '{N} got it!', jump: '{N} can jump up high.', little: 'The {B} is little.', look: '"Look!" said {N}.',
  make: '"Let us make a hat," said {N}.', me: '"Look at me!" said the {B}.', my: '"This is my {B}," said {N}.', not: 'The {B} is not sad.',
  one: '{N} had one snack.', play: '{N} and the {B} play all day.', red: '{N} has a red cup.', run: '{N} can run fast.',
  said: '"Hi!" said the {B}.', see: '"I see a bug," said {N}.', the: 'The {B} sat in the sun.', three: 'They saw three big rocks.',
  to: 'They ran to the top of the hill.', two: '{N} had two red hats.', up: 'Up, up, up they went!', we: '"We can do it!" said {N}.',
  where: '"Where is the {B}?" said {N}.', yellow: 'The sun is yellow.', you: '"I like you," said the {B}.', all: 'They all had fun.',
  am: '"I am {N}," said {N}.', are: '"You are my pal," said {N}.', at: 'They sat at the top of the hill.', ate: 'The {B} ate a snack.',
  be: '"I will be fast," said the {B}.', black: 'The {B} had a black hat.', brown: 'They sat on a brown log.', but: 'The {B} ran, but {N} was fast.',
  came: 'The {B} came to play.', did: '{N} did a big jump.', do: '"What can we do?" said {N}.', eat: '"Let us eat," said the {B}.',
  four: '{N} saw four bugs.', get: '"Get the ball!" said {N}.', good: '"Good job!" said the {B}.', have: '"I have a hat," said {N}.',
  he: 'He is a good pal.', into: '{N} ran into the tent.', like: '"I like to dig," said {N}.', must: '"We must go," said the {B}.',
  new: '{N} got a new cap.', no: '"No, no, no!" said the {B}.', now: '"Go now!" said {N}.', on: '{N} sat on a rug.',
  our: '"This is our den," said {N}.', out: '{N} ran out to play.', please: '"Please come," said {N}.', pretty: 'It is a pretty day.',
  ran: '{N} ran and ran.', ride: '"Can I ride?" said {N}.', saw: '{N} saw a big hill.', say: '"Say hi!" said {N}.',
  she: 'She is a good pal.', so: 'It is so fun!',
};

/** Math in a week's word problems: totals the week can handle. */
function problemRange(level: Level, step: MathStep): { max: number; subtract: boolean } {
  if (step.addTo) return { max: step.addTo, subtract: level === 'kindergarten' };
  const n = step.number ?? 1;
  if (level === 'pre-k') return { max: Math.max(3, Math.min(5, n + 1)), subtract: false };
  return { max: Math.max(5, Math.min(10, n)), subtract: n >= 5 };
}

/** A small deterministic random source per child-week, so redoing a week gives the same problems. */
function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

function makeProblems(theme: ThemeId, level: Level, step: MathStep, seed: string): Problem[] {
  const T = THEMES[theme];
  const rand = seeded(seed);
  const { max, subtract } = problemRange(level, step);
  // The buddy is a character in the problems, so it isn't also something to count.
  const icons = T.icons.filter((i) => i.id !== 'palm-tree' && i.id !== T.buddy.icon && i.one !== T.buddy.one.replace('little ', ''));
  const pickIcon = (k: number, from = icons) => from[(Math.floor(rand() * from.length) + k) % from.length];
  // Take-away problems never use places or fixed things (a volcano, a barn, a tunnel, the sun can't "go away").
  const takeAway = icons.filter((i) => iconKind(theme, i) !== 'place');
  const count = level === 'pre-k' ? 4 : 5;
  const out: Problem[] = [];
  const seen = new Set<string>();
  // Two cast members from the story world give objects to each other ("Stomp has 4 eggs. Stomp gives 1 to Dot.").
  const cast = SCENES[theme].cast;
  const giver = cast[0]?.name.replace(/^(Princess|Sir) /, '') ?? '{{name}}';
  const taker = cast[1]?.name ?? `the ${T.buddy.one}`;
  const addFrames = [
    (a: number, b: number, ic: ThemeIcon) => `{{name}} counts ${a} ${ofIcon(a, ic)} ${T.place}. Then {{name}} spots ${b} more. How many ${ic.many} now?`,
    (a: number, b: number, ic: ThemeIcon) => `The ${T.buddy.one} sees ${a} ${ofIcon(a, ic)}, and then ${b} more. How many ${ic.many} in all?`,
    (a: number, b: number, ic: ThemeIcon) => `There ${a === 1 ? 'is' : 'are'} ${a} ${ofIcon(a, ic)} and ${b} more ${ofIcon(b, ic)}. How many ${ic.many} altogether?`,
  ];
  const subFrames: Record<'animal' | 'object', ((a: number, b: number, ic: ThemeIcon) => string)[]> = {
    // Animals, characters and vehicles move by themselves.
    animal: [
      (a, b, ic) => `There are ${a} ${ic.many} ${T.place}. ${b} ${b === 1 ? 'goes' : 'go'} away. How many ${ic.many} are left?`,
      (a, b, ic) => `${a} ${ic.many} wait ${T.place}. ${b} ${b === 1 ? 'goes' : 'go'} home. How many ${ic.many} are still there?`,
    ],
    // Objects are held and given.
    object: [
      (a, b, ic) => `${giver} has ${a} ${ic.many}. ${giver} gives ${b} to ${taker}. How many ${ic.many} does ${giver} have left?`,
      (a, b, ic) => `{{name}} has ${a} ${ic.many} and gives ${b} to the ${T.buddy.one}. How many ${ic.many} does {{name}} have left?`,
    ],
  };
  for (let t = 0; out.length < count && t < 200; t++) {
    const i = out.length;
    const takes = subtract && i % 2 === 1 && i !== count - 1;
    const ic = takes && takeAway.length ? pickIcon(i, takeAway) : pickIcon(i);
    if (i === count - 1) {
      // Last problem compares two groups.
      const a = 1 + Math.floor(rand() * max), b0 = 1 + Math.floor(rand() * max);
      const b = a === b0 ? (a === max ? a - 1 : a + 1) : b0;
      if (b < 1) continue;
      out.push(cmp(`{{name}} counts ${a} ${ofIcon(a, ic)}. The ${T.buddy.one} counts ${b}. Write the bigger number.`, a, b, ic.id));
      break;
    }
    if (takes && takeAway.length) {
      const a = 3 + Math.floor(rand() * (max - 2)), b = 1 + Math.floor(rand() * (a - 1));
      const key = `-${a}-${b}`;
      if (a > max || seen.has(key)) continue;
      seen.add(key);
      const frames = subFrames[iconKind(theme, ic) === 'object' ? 'object' : 'animal'];
      out.push(sub(frames[Math.floor(i / 2) % frames.length](a, b, ic), a, b, ic.id));
    } else {
      const a = 1 + Math.floor(rand() * (max - 1)), b = 1 + Math.floor(rand() * (max - a));
      const key = `+${a}-${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(add(addFrames[i % addFrames.length](a, b, ic), a, b, ic.id));
    }
  }
  return out;
}

function sightLine(word: string, theme: ThemeId): string {
  const f = SIGHT[word] ?? SIGHT[word.toLowerCase()] ?? '{N} and the {B} play.';
  const s = f.replace(/\{B\}/g, THEMES[theme].buddy.one).replace(/\{N\}/g, '{{name}}');
  return cap1(s);
}

/** Sets each page's picture to the pictured thing that page names (the buddy's picture when it only names the
 *  buddy). Every generated page is written to name one, so no page is left without a picture. */
function withIcons(theme: ThemeId, story: { title: string; pages: string[] }): WeekContent['story'] {
  // A page that names nothing we have a picture for ("Look! A cat.") gets a short cheer for the buddy, which does.
  const pages = story.pages.map((p) => (storyIcon(theme, p) ? p : `${p} ${CHEER[theme]}`));
  return { ...story, pages, icons: pages.map((p) => storyIcon(theme, p)) };
}
/** A tense-free line that names a pictured thing (the buddy, or for sports the ball), for pages about other things. */
const CHEER: Record<ThemeId, string> = {
  dinosaurs: 'Stomp, stomp, little T-rex!', trucks: 'Beep, beep, little red truck!', unicorns: 'Hop, hop, little unicorn!',
  ocean: 'Snap, snap, little crab!', space: 'Zoom, zoom, little alien!', farm: 'Oink, oink, little pig!',
  bugs: 'Fly, fly, little ladybug!', castles: 'Flap, flap, little dragon!', trains: 'Toot, toot, little red engine!',
  sports: 'Kick the soccer ball, team!', pets: 'Wag, wag, little pup!', jungle: 'Swing, swing, little monkey!',
};

function storyFor(level: Level, w: Week, pw: ProgramWeek): WeekContent['story'] {
  // Week 1 is path 0 (the free week), so week n gets path n - 1.
  return sceneStoryFor(pw.theme, level, w, pw, pw.index - 1) ?? withIcons(pw.theme, storyText(level, w, pw));
}

function storyText(level: Level, w: Week, pw: ProgramWeek): { title: string; pages: string[] } {
  const T = THEMES[pw.theme];
  const B = T.buddy.one;
  const ic = T.icons;
  const n = pw.math?.number;
  const counted = ic.find((i) => i.id !== T.buddy.icon && i.small) ?? ic.find((i) => i.id !== T.buddy.icon) ?? ic[0];
  const countLine = n ? `Together they count ${n} ${ofIcon(n, counted)}. ${n > 1 ? `1, 2${n > 2 ? `, all the way to ${n}` : ''}!` : 'Just one!'}` : `They count the ${counted.many} two at a time.`;
  const open = `{{name}} and the ${B} go out to play ${T.place}.`;
  const close = level === 'pre-k' ? `What a day ${T.place}! Good night, ${B}. Good night, {{name}}.` : `{{name}} and the ${B} had a fun day.`;

  if (w.kind === 'name') {
    return { title: titleCase(`{{name}} and the ${B}`), pages: [open, `The ${B} wants to know {{name}}'s name.`, `{{name}} says it slowly for the ${B}, one letter at a time.`, `The ${B} draws each letter in the dirt with a stick.`, countLine, close] };
  }

  if (w.kind === 'letter' || w.kind === 'review') {
    const ls = pw.extraReview ? reviewLetters(pw) : w.letters;
    const pages = [open];
    if (level === 'pre-k') {
      pages.push(ls.length === 1 ? `{{name}} and the ${B} look for things that start with /${ls[0]}/.` : `{{name}} and the ${B} look for things that start with ${ls.map((l) => `/${l}/`).join(', ').replace(/, ([^,]*)$/, ' and $1')}.`);
      for (const l of ls.slice(0, 3)) {
        const words = startWords(l);
        // A theme word when one starts with the letter (singular, so "a claws" never happens), else a letter word.
        const single = (x: string) => !/[^s]s$/i.test(x);
        const themed = T.icons.map((i) => i.one).find((x) => single(x) && x.toLowerCase().startsWith(l)) ?? T.nouns.find((x) => single(x) && x.toLowerCase().startsWith(l));
        const word = themed ?? words[0] ?? l;
        pages.push(`Look! ${themed ? cap1(art(word)) : `The ${B} finds ${art(word)}`} ${word}. ${cap1(word)} starts with ${l.toUpperCase()}. /${l}/, /${l}/, ${word}!`);
      }
      if (pages.length < 5) pages.push(`The ${B} finds ${art(startWords(ls[0])[1] ?? 'egg')} ${startWords(ls[0])[1] ?? 'egg'} too. /${ls[0]}/!`);
      pages.push(countLine, close);
    } else {
      pages.push(`{{name}} and the ${B} play a sound game: find things with ${ls.map((l) => `/${l}/`).join(' and ')}.`);
      for (const l of ls.slice(0, 2)) {
        const [w1, w2] = CVC_NOUNS[l] ?? [l];
        const ends = l === 'x' ? 'ends' : 'starts';
        pages.push(w2 ? `{{name}} and the ${B} find ${art(w1)} ${w1} and ${art(w2)} ${w2}. ${cap1(w1)} and ${w2} ${ends === 'ends' ? 'end' : 'start'} with /${l}/.` : `{{name}} finds ${art(w1)} ${w1}. ${cap1(w1)} ${ends} with /${l}/.`);
      }
      for (const s of w.sightWords.slice(0, 2)) pages.push(sightLine(s, pw.theme));
      pages.push(close);
    }
    return { title: titleCase(`{{name}} and the ${B}`), pages: pages.slice(0, 8) };
  }

  const fams = w.kind === 'family' ? [w.family!] : (w.families ?? []);
  // Mixed reviews take a word from each family first.
  const spread = (lists: string[][]) => { const out: string[] = []; for (let i = 0; i < 4; i++) for (const l of lists) if (l[i] && !out.includes(l[i])) out.push(l[i]); return out; };
  const nouns = spread(fams.map((f) => FAMILY_NOUNS[f] ?? []));
  const words = spread(fams.map((f) => FAMILIES[f] ?? []));
  const pages = [open];
  pages.push(fams.length === 1 ? `{{name}} and the ${B} play a word game. Every word ends in -${fams[0]}.` : `{{name}} and the ${B} play a word game with ${fams.map((f) => `-${f}`).join(', ')} words.`);
  if (nouns[0]) pages.push(`Look! The ${B} finds ${art(nouns[0])} ${nouns[0]}.`);
  if (nouns[1]) pages.push(`The ${B} finds ${art(nouns[1])} ${nouns[1]}${nouns[2] ? ` and ${art(nouns[2])} ${nouns[2]}` : ''}.`);
  for (const s of w.sightWords.slice(0, 2)) pages.push(sightLine(s, pw.theme));
  pages.push(`${words.slice(0, 3).map(cap1).join(', ')}! ${fams.length === 1 ? `They all end in -${fams[0]}.` : 'Short words are fun.'}`);
  pages.push(close);
  return { title: titleCase(`{{name}} and the ${B}`), pages: pages.slice(0, 8) };
}

/** Short decodable tracing sentences about each theme, rotated by week (all fit the AI rules: 2 to 8 words, letters only). */
const THEME_SENTENCES: Record<ThemeId, string[]> = {
  dinosaurs: ['I see a big T-rex.', 'The egg can crack.', 'A dino can stomp.', 'I dig up a bone.', 'The T-rex is red.', 'Dinos run in the sun.', 'A big egg is in a nest.', 'I like the long neck.'],
  trucks: ['I see a big truck.', 'The truck can dig.', 'The truck can go beep.', 'A red bus can stop.', 'The digger can lift.', 'Trucks go up a hill.', 'I see a tow truck.', 'The van is in the mud.'],
  unicorns: ['I see a unicorn.', 'A unicorn can hop.', 'I see a rainbow.', 'The gem is pink.', 'A star is up high.', 'The cloud is soft.', 'I hug my unicorn.', 'Hop over the rainbow.'],
  ocean: ['I see a fish.', 'A crab can dig.', 'The fish can swim.', 'A shell is on the sand.', 'The turtle swims.', 'A wave is big.', 'I see a red crab.', 'Fish swim in the sea.'],
  space: ['I see a rocket.', 'The rocket can zoom.', 'A star is up high.', 'The moon is big.', 'I see a planet.', 'Up goes the rocket.', 'An alien can hop.', 'Stars at night.'],
  farm: ['I see a pig.', 'A hen sat on an egg.', 'The cow says moo.', 'A pig is in the mud.', 'The red barn is big.', 'I see a duck.', 'A hen can peck.', 'The pig can run.'],
  bugs: ['I see a bug.', 'A bee can buzz.', 'The ant can dig.', 'A bug is on a leaf.', 'The ladybug has spots.', 'I see a red bug.', 'A snail is slow.', 'Bugs hop in the sun.'],
  castles: ['I see a castle.', 'The dragon can fly.', 'A crown is on top.', 'The castle is big.', 'A dragon naps.', 'I see a red flag.', 'The gate is up.', 'The knight has a shield.'],
  trains: ['I see a train.', 'The train can go.', 'The train can toot.', 'The train is on the track.', 'A train went up a hill.', 'I see a red engine.', 'The train can stop.', 'The tunnel is dark.'],
  sports: ['I can kick a ball.', 'I can hit the ball.', 'The ball is in the net.', 'I run fast.', 'We win a medal.', 'The team can run.', 'I can jump up.', 'Kick it in the goal.'],
  pets: ['I love my pup.', 'The cat can nap.', 'My pup can sit.', 'The pup has a ball.', 'A cat sat on a mat.', 'I pet my cat.', 'The pup can run.', 'My fish can swim.'],
  jungle: ['I see a lion.', 'A monkey can swing.', 'The hippo is big.', 'I see an elephant.', 'A monkey has a banana.', 'The lion naps in the sun.', 'A zebra can run.', 'The parrot can sing.'],
};

/** Kindergarten word family sentences that also name the interest ("The cat sat by the T-rex."). */
const FAMILY_WITH: Record<ThemeId, string> = {
  dinosaurs: 'T-rex', trucks: 'truck', unicorns: 'unicorn', ocean: 'crab', space: 'rocket', farm: 'pig',
  bugs: 'bug', castles: 'castle', trains: 'train', sports: 'ball', pets: 'pup', jungle: 'monkey',
};

function sentenceFor(level: Level, w: Week, pw: ProgramWeek): string {
  const list = THEME_SENTENCES[pw.theme];
  const pick = list[(Math.max(1, pw.index) - 1) % list.length];
  const fams = w.kind === 'family' ? [w.family!] : (w.families ?? []);
  const nouns = fams.flatMap((f) => FAMILY_NOUNS[f] ?? []);
  // Kindergarten family weeks: the family word and the interest together, so the sentence teaches both.
  if (level === 'kindergarten' && nouns.length) {
    const n = nouns[(Math.max(1, pw.index) - 1) % nouns.length];
    return `I see ${art(n)} ${n} and ${art(FAMILY_WITH[pw.theme])} ${FAMILY_WITH[pw.theme]}.`;
  }
  return pick;
}

function noteFor(level: Level, w: Week, pw: ProgramWeek): WeekContent['parentNote'] {
  const T = THEMES[pw.theme];
  const step = pw.math;
  const math = step?.addTo ? `adding within ${step.addTo}` : step?.number ? `the number ${step.number}` : 'counting';
  const ls = pw.extraReview && (w.kind === 'letter' || w.kind === 'review') ? reviewLetters(pw) : w.letters;
  const fams = w.kind === 'family' ? [w.family!] : (w.families ?? []);
  let teaches: string;
  let why: string;
  let focus: string;
  if (w.kind === 'name') {
    teaches = `This week is about {{name}}'s name, with ${math} for math.`;
    why = 'Their own name is the word kids care about most, which makes it a friendly place to start.';
    focus = 'letter from their name';
  } else if (w.kind === 'letter' || w.kind === 'review') {
    const list = ls.map((l) => `${l.toUpperCase()} (/${l}/)`).join(', ');
    teaches = `${pw.extraReview || w.kind === 'review' ? 'A review week' : 'This week'}: ${list}, plus ${math}.${w.sightWords.length ? ` Sight words: ${w.sightWords.join(', ')}.` : ''}`;
    why = pw.extraReview
      ? 'A second look at letters that are still settling in. Many kids need a few passes before a letter sticks, and that is normal.'
      : 'Knowing the sound a letter makes is what lets kids sound out words later. Saying the sound out loud while tracing helps it stick.';
    focus = `word that starts with ${ls.map((l) => `/${l}/`).join(' or ')}`;
  } else {
    teaches = `${pw.extraReview || w.kind === 'vowel-review' ? 'A review week' : 'This week'}: ${fams.map((f) => `-${f}`).join(', ')} words, plus ${math}.${w.sightWords.length ? ` Sight words: ${w.sightWords.join(', ')}.` : ''}`;
    why = 'Word families show kids that changing one sound makes a new word. Once a family clicks, a whole group of words opens up for reading.';
    focus = `word that rhymes with ${(FAMILIES[fams[0]] ?? ['cat'])[0]}`;
  }
  const n = Math.max(3, step?.number ?? step?.addTo ?? 5);
  const ACT: Record<ThemeId, [string, string]> = {
    dinosaurs: [`Hide ${n} toy dinosaurs (or blocks) around a room and count them as {{name}} finds each one.`, `Stomp like a T-rex. With each stomp, {{name}} says a FOCUS.`],
    trucks: [`Park ${n} toy cars in a row and count them. Drive one away and count again.`, `Play red light, green light. On each green light, {{name}} says a FOCUS.`],
    unicorns: [`Count out ${n} stickers or paper stars and line them up like a rainbow.`, `Gallop like a unicorn. Stop and say a FOCUS each time the music stops.`],
    ocean: [`Fill a tub with water and count ${n} cups as {{name}} pours.`, `Go "fishing" with a spoon for paper fish. For each catch, {{name}} says a FOCUS.`],
    space: [`Count down from ${Math.min(10, n + 3)} to 0 before every snack, then blast off!`, `Shine a flashlight on the ceiling like a star. Each time it lands, {{name}} says a FOCUS.`],
    farm: [`Count ${n} eggs, crackers or toy animals into a bowl. Take a few out and count what is left.`, `Make an animal sound, and {{name}} answers with a FOCUS.`],
    bugs: [`Go on a bug hunt outside or in a book and count the bugs you find, up to ${n}.`, `Pretend to be a caterpillar. Each wiggle forward, {{name}} says a FOCUS.`],
    castles: [`Build a block tower with ${n} blocks. Count each block as it goes on.`, `Play royal court: {{name}} gets a bow for each FOCUS they say.`],
    trains: [`Line up ${n} chairs or pillows like train cars and count them as you ride along.`, `Toot like a train. Each toot, {{name}} says a FOCUS.`],
    sports: [`Count ${n} kicks, bounces or jumps. Then try one more.`, `Toss a soft ball back and forth. Each catch, {{name}} says a FOCUS.`],
    pets: [`Count ${n} pet treats or crackers into a bowl, then take them out one at a time.`, `Play "fetch": toss a sock, and when {{name}} brings it back, they say a FOCUS.`],
    jungle: [`Count ${n} bananas, grapes or crackers at snack time.`, `Swing your arms like a monkey. Each swing, {{name}} says a FOCUS.`],
  };
  const [a1, a2] = ACT[pw.theme];
  return { teaches, why: `${why} Pictures of ${T.short} keep it fun.`, activities: [a1, a2.replace('FOCUS', focus)] };
}

/**
 * Template content for any week of any child's plan. Week 1 of a plan that starts on the name week uses the
 * hand-written free week. Everything else is built from the theme's word lists and the week's skills.
 */
export function templateContentFor(profile: ChildProfile, week: ProgramWeek): WeekContent {
  const base = baseWeekOf(week);
  if (base.kind === 'name' && !week.extraReview && week.index === 1) return freeWeekContent(week.theme, week.level);
  const level = week.level;
  const step: MathStep = week.math ?? (base.addTo ? { addTo: base.addTo } : { number: base.number || 1 });
  return {
    source: 'template',
    story: storyFor(level, base, { ...week, math: step }),
    wordProblems: makeProblems(week.theme, level, step, `${profile.id}-${week.index}-${week.theme}`),
    tracingSentence: sentenceFor(level, base, week),
    parentNote: noteFor(level, base, { ...week, math: step }),
  };
}

/** For the timeline: one short line on what a week covers. */
export function weekBlurb(week: ProgramWeek): string {
  const b = baseWeekOf(week);
  const T = THEMES[week.theme];
  const m = week.math?.addTo ? `adding within ${week.math.addTo}` : week.math?.number ? `the number ${week.math.number}` : '';
  const what = b.kind === 'name' ? 'their name' : b.kind === 'family' ? `-${b.family} words` : b.kind === 'vowel-review' ? `short ${b.letters[0]} words` : (week.extraReview ? reviewLetters(week) : b.letters).map((l) => l.toUpperCase()).join(', ');
  return `${what}${m ? `, ${m}` : ''}, with ${T.short}`;
}

export { PLANS };
