/* flashy-dict.js — the spell checker's word list
 *
 * The first audit refused to build a real spell check, on the grounds that
 * "an English word list big enough to avoid false positives would be larger
 * than the whole editor". That is measurably false: `editor-app.js` is about
 * 1.27 MB, and a 50,000-word list is about 450 KB — a third of it. The claim
 * was wrong and the feature was skipped on the strength of it.
 *
 * The second objection was right, though, and it is the one that shapes this
 * file: "a spell check that flags every proper noun gets switched off within
 * a minute, at which point it has made things worse." So the design is about
 * never crying wolf:
 *
 *   - Two severities, not one. A word in the KNOWN-WRONG table is a
 *     misspelling with a confident correction. A word merely absent from the
 *     list is UNKNOWN, which is a question rather than an accusation, and it
 *     only gets a suggestion when a close match actually exists.
 *   - Capitalised words mid-sentence are skipped as proper nouns, and so are
 *     ALL-CAPS runs, numbers, URLs, file names and code-shaped identifiers.
 *   - Affixes are stripped before the lookup, so one entry covers "walk",
 *     "walks", "walked", "walking" and "walker".
 *   - A personal dictionary, and an IMPORTED one. Flash's dictionaries were
 *     selectable and it shipped several; `importDictionary()` takes a plain
 *     word-per-line list, which is the format every such list already uses.
 *
 * WHAT THIS LIST IS, precisely: the common core of written English, about two
 * and a half thousand words -- including the irregular past tenses, because no
 * amount of stripping "-ed" reaches "sat" from "sit", and leaving them out put
 * two false positives in the eight words of "I met her and we sat down". The
 * top couple of thousand English words cover roughly four fifths of running
 * text, and affix stripping lifts the effective coverage further.
 * It is not a complete dictionary and does not pretend to be one — which is
 * exactly why an absent word is reported as unknown rather than as wrong, and
 * why the import exists. Saying "about 80% of ordinary prose, and here is how
 * to load the rest" is honest; shipping 450 KB and calling it complete would
 * not be, and neither was refusing to ship anything.
 *
 * The list lives in its own file so it can be replaced wholesale without
 * touching the editor, and so the cost of it is visible in a directory
 * listing rather than buried in a megabyte of application code.
 */
(function (global) {
  "use strict";

  /* Grouped by what the words are, because a flat alphabetical blob is
     impossible to review and reviewing it is the only way it stays correct. */
  var GROUPS = {
    // Function words: the top of every frequency list by a wide margin.
    core:
      "a able about above across after again against all almost alone along " +
      "already also although always am among an and another any anybody " +
      "anyone anything anyway anywhere apart are around as aside ask at " +
      "away back be became because become been before began begin behind " +
      "being below beneath beside best better between beyond both but by " +
      "came can cannot could couple course did different do does doing done " +
      "down during each either else enough even ever every everybody " +
      "everyone everything everywhere except far few fewer first for from " +
      "further get gets getting give given go goes going gone got had half " +
      "has have having he her here hers herself him himself his how however " +
      "if in indeed inside instead into is it its itself just keep kept " +
      "last late later least left less let like likely little long made " +
      "make makes making many may maybe me mean means meant might mine " +
      "more most much must my myself near nearly need neither never " +
      "nevertheless new next no nobody none nor not nothing now nowhere of " +
      "off often on once one only onto or other others otherwise ought our " +
      "ours ourselves out outside over own part per perhaps put rather " +
      "really right said same saw say says see seem seen several shall she " +
      "should since so some somebody somehow someone something sometimes " +
      "somewhat somewhere soon still such take taken takes taking than that " +
      "the their theirs them themselves then there therefore these they " +
      "thing things think this those though three through thus to together " +
      "too took toward towards two under unless until up upon us use used " +
      "useful uses using usually very was way we well were what whatever " +
      "when whenever where whereas whether which while who whoever whole " +
      "whom whose why will with within without would yes yet you your " +
      "yours yourself yourselves",

    // Verbs that carry most sentences.
    verbs:
      "accept add admit agree allow announce answer appear apply argue " +
      "arrange arrive attack attend avoid base bear beat believe belong " +
      "bend bite blow boil borrow break breathe bring build burn burst buy " +
      "call carry catch cause change charge check choose claim clean clear " +
      "climb close collect come compare complain complete concern confirm " +
      "connect consider contain continue control cook copy correct cost " +
      "count cover create cross cry cut damage dance deal decide decline " +
      "deliver depend describe design destroy develop die dig disappear " +
      "discover discuss divide draw dream dress drink drive drop dry earn " +
      "eat elect encourage end enjoy enter escape examine exist expect " +
      "explain explore express fail fall feed feel fight fill find finish " +
      "fit fix fly fold follow forget forgive form found freeze gather grow " +
      "guess handle hang happen hate head hear help hide hit hold hope hurry " +
      "hurt identify ignore imagine improve include increase indicate " +
      "influence inform insist intend introduce invite involve join joke " +
      "judge jump justify kick kill kiss knock know lack land laugh lay lead " +
      "lean learn leave lend lie lift light listen live load lock look lose " +
      "love manage mark marry match matter measure meet melt mention mind " +
      "miss mix move name notice obtain occur offer open operate order " +
      "organise organize own paint pass pay perform pick place plan play " +
      "point pour practise prefer prepare present preserve press pretend " +
      "prevent produce promise propose protect prove provide pull push " +
      "qualify raise reach read realise realize receive recognise recognize " +
      "recommend record reduce refer reflect refuse regard register relate " +
      "release remain remember remind remove repeat replace reply report " +
      "represent request require rest result return reveal ride ring rise " +
      "roll run save scream search seek select sell send separate serve set " +
      "settle shake share shine shoot shop shout show shut sing sink sit " +
      "sleep slide smell smile smoke solve sort sound speak spell spend " +
      "spread stand stare start stay steal step stick stop stretch strike " +
      "study succeed suffer suggest supply support suppose surprise survive " +
      "swim switch talk taste teach tear tell tend test thank throw tie " +
      "touch train travel treat try turn understand unite visit vote wait " +
      "wake walk want warn wash watch wave wear weigh welcome win wish " +
      "wonder work worry wrap write",

    // Everyday nouns.
    nouns:
      "accident account act action address adult advice age agreement air " +
      "amount animal answer apple area arm army art article attack attempt " +
      "attention aunt baby back bag ball band bank bar base basket bath " +
      "beach bean bear bed bedroom bee beer beginning bell belt bicycle bill " +
      "bird birth birthday bit blood board boat body bone book boot bottle " +
      "bottom box boy brain branch bread breakfast breath bridge brother " +
      "brush building bus bush business butter button cake camera camp car " +
      "card care carpet cat cause ceiling cell cent centre chain chair " +
      "chance change chapter character charge cheese chest chicken child " +
      "children chocolate choice church cinema circle city class clock cloth " +
      "clothes cloud club coal coast coat coffee coin cold college colour " +
      "comfort company computer concert condition control cook copy corner " +
      "cost cotton country couple course court cover cow crime crowd cup " +
      "curtain customer dance danger date daughter day death decision degree " +
      "department desk detail development diamond difference difficulty " +
      "dinner direction discussion distance district doctor dog dollar door " +
      "doubt dozen dream dress drink driver drop duck dust duty ear earth " +
      "east edge education effect effort egg election electricity elephant " +
      "end enemy energy engine entrance envelope evening event example " +
      "exercise exhibition expense experience explanation eye face fact " +
      "factory failure family farm farmer fashion father fear feather field " +
      "fight figure film finger fire fish flag flat floor flour flower fly " +
      "food foot football forest fork form fortune frame freedom friend " +
      "fruit fun furniture future game garage garden gas gate girl glass " +
      "glove goal gold government grain grammar grass ground group growth " +
      "guest guide gun hair half hall hand handle harbour hat head health " +
      "heart heat height help hill history hole holiday home honey hope " +
      "horse hospital hotel hour house hundred husband ice idea income " +
      "industry information ink insect instrument interest iron island " +
      "jacket jam job journey joy judge juice jump justice key kind king " +
      "kitchen knee knife knowledge lady lake lamp land language laugh law " +
      "leaf learning leather leg length lesson letter level library lift " +
      "light limit line lip liquid list listener literature load loaf lock " +
      "look loss love luck lunch machine magazine mail man manager map market " +
      "marriage mass match material matter meal meaning measure meat medicine " +
      "meeting member memory message metal method middle mile milk million " +
      "mind mine minute mirror mistake mixture model moment money monkey " +
      "month moon morning mother motion mountain mouth movement music nail " +
      "name nation nature neck need needle neighbour nerve news newspaper " +
      "night noise north nose note notice number nurse object ocean offer " +
      "office oil opinion opportunity orange order organisation organization " +
      "owner page pain paint pair paper parcel parent park part partner " +
      "party passage past path patient pattern payment peace pen pencil " +
      "people pepper performance period person petrol picture piece pig pin " +
      "pipe place plan plane plant plastic plate play player pleasure " +
      "pocket point police policy pool population position possibility post " +
      "pot potato pound power practice present president press price pride " +
      "prison prize problem process produce product profit programme progress " +
      "promise proof property protest public pull purpose quality quantity " +
      "quarter queen question race radio rail rain range rate reaction " +
      "reading reason receipt record region relation religion report request " +
      "research respect responsibility rest result return rice ring rise " +
      "river road rock roll roof room root rope rose round row rule run " +
      "safety sail salt sand scale scene school science sea search season " +
      "seat second secret secretary section seed sense sentence series " +
      "service shade shadow shape share sheep sheet shelf shell ship shirt " +
      "shock shoe shop shore show side sight sign silence silk silver " +
      "sister situation size skill skin skirt sky sleep slope smell smile " +
      "smoke snow soap society sock soil soldier solution son song sort " +
      "sound soup south space speech speed spirit spoon sport spot spring " +
      "square stage stairs stamp star start state station steam steel stem " +
      "step stick stitch stomach stone stop store storm story stream street " +
      "strength structure student study stuff style subject substance " +
      "success sugar suggestion suit summer sun supper supply support " +
      "surface surprise sweet swim system table tail tape taste tax tea " +
      "teacher team tear telephone television temperature tent term test " +
      "text theatre theory thing thought thread throat thumb thunder ticket " +
      "time tin title tobacco today toe tomorrow tongue tonight tool tooth " +
      "top total touch town trade traffic train transport travel tray tree " +
      "trick trip trouble trousers truck trust truth tube tune turn type " +
      "uncle unit university use value vegetable vehicle verse version " +
      "victory view village visit voice volume wage wall war warmth wash " +
      "waste watch water wave wax way weather week weight wheel wife wind " +
      "window wine wing winter wire wish woman women wood wool word work " +
      "worker world worth wound writer writing year yesterday youth",

    // Adjectives and adverbs.
    modifiers:
      "absent absolute actual afraid alive angry annual anxious apparent " +
      "automatic available average awake aware bad basic beautiful big " +
      "bitter black blue bold brave bright broad brown busy calm careful " +
      "certain cheap cheerful chief civil clean clear clever close cloudy " +
      "coarse cold comfortable common complete complex confident conscious " +
      "constant cool correct cruel curious current curly daily damp dark " +
      "dead dear deep delicate dependent desperate detailed dirty distant " +
      "double dry dull eager early easy effective elaborate electric elegant " +
      "empty entire equal essential even eventual exact excellent exciting " +
      "expensive external extra extreme faint fair faithful false familiar " +
      "famous fast fat favourite fierce final financial fine firm fit flat " +
      "foolish foreign formal former fortunate forward free fresh friendly " +
      "frozen full funny general gentle genuine giant glad global golden " +
      "good grateful great green grey guilty handsome happy hard harsh " +
      "healthy heavy helpful high historical honest horizontal hot huge " +
      "human humble hungry ideal ill immediate important impossible " +
      "independent individual industrial inner innocent intelligent intense " +
      "interesting internal international joint kind known large last late " +
      "lazy leading legal light limited liquid live local lonely loose loud " +
      "low loyal lucky mad main major married mathematical mature maximum " +
      "mean medical medium mental merry middle mild military minimum minor " +
      "mixed modern moral narrow national native natural naughty near neat " +
      "necessary negative nervous neutral nice noble noisy normal northern " +
      "numerous obvious odd official old open opposite ordinary original " +
      "other outer overall painful pale parallel particular past patient " +
      "perfect permanent personal physical pink plain pleasant polite " +
      "political poor popular positive possible powerful practical precious " +
      "precise pregnant present pretty previous primary prime principal " +
      "private probable proper proud public pure purple quick quiet rapid " +
      "rare raw ready real reasonable recent red regular relative relevant " +
      "reliable remote responsible rich ridiculous right rigid ripe rough " +
      "round royal rude sad safe scientific secret secure senior sensible " +
      "sensitive separate serious severe sharp short shy sick significant " +
      "silent silly similar simple single slight slim slow small smart " +
      "smooth social soft solid sorry sound sour southern special specific " +
      "steady steep stiff still straight strange strict strong stupid " +
      "subtle sudden sufficient suitable sunny superior sure surprised sweet " +
      "swift tall technical temporary tender terrible thick thin thirsty " +
      "thorough tight tiny tired total tough traditional true typical ugly " +
      "unable uncomfortable unhappy uniform unique universal unknown unusual " +
      "upper upset urgent useful useless usual vague valuable various vast " +
      "vertical violent visible vital warm weak wealthy welcome western wet " +
      "white whole wide wild willing winter wise wonderful wooden worth " +
      "wrong yellow young " +
      // Adverbs that are not just adjective+ly.
      "abroad ahead almost already also always anyhow anymore anytime " +
      "backwards below besides downstairs elsewhere everywhere forever " +
      "forth forwards hardly hence henceforth here hereby indoors inwards " +
      "likewise meanwhile midway moreover nearby nonetheless northwards " +
      "nowadays often onwards outdoors outwards overhead overnight " +
      "perhaps rarely seldom sideways somewhere southwards straightaway " +
      "thereafter thereby therein thereof thereupon throughout thrice " +
      "today tomorrow tonight twice underground underneath upstairs " +
      "upwards whereby wherein whereupon worldwide yesterday",

    // Time, number and measure.
    quantity:
      "billion dozen eight eighteen eighty eleven fifteen fifth fifty " +
      "first five forty four fourteen fourth fourteenth hundred million " +
      "nine nineteen ninety ninth one second seven seventeen seventh " +
      "seventy six sixteen sixth sixty ten tenth third thirteen thirty " +
      "thousand three twelve twentieth twenty two zero " +
      "january february march april may june july august september october " +
      "november december monday tuesday wednesday thursday friday saturday " +
      "sunday spring summer autumn winter " +
      "centimetre centimeter decade degree foot gram hour inch kilo " +
      "kilogram kilometre kilometer litre liter metre meter mile millimetre " +
      "millimeter minute month ounce percent pint pound quart second week " +
      "weekend year yard",

    /* The words this editor's own users write about their own work. A spell
       check that flags "keyframe", "tween" and "onion" in a project about
       animation is the kind that gets switched off. */
    domain:
      "alpha animate animated animation anchor armature artwork aspect " +
      "asset audio background bezier bitmap bone border bounce brush " +
      "button canvas caption cel centre character clip codec colour " +
      "compress compression cursor curve default dialog dialogue " +
      "distort dither document drag dropdown easing edit editor effect " +
      "envelope export fade file fill filter font frame gradient graphic " +
      "grid group guide hairline handle hatched icon image import inbetween " +
      "interface keyframe layer library linear loop mask menu mono motion " +
      "movie onion opacity outline overlay palette panel paste path pencil " +
      "pixel playback playhead plugin polygon preview project publish " +
      "radial raster render resample resize resolution rig rotate rotation " +
      "ruler sample scene screenshot script scroll select selection shape " +
      "sidebar skew slider snap sound sprite stage stipple stroke symbol " +
      "template text texture thumbnail timeline timing toolbar tooltip " +
      "trace transform transition transparency tween undo vector video " +
      "viewport volume warp waveform widget window workspace zoom",

    /* Irregular past tenses and participles.
     *
     * The structural gap in affix stripping, and the one the specs found: no
     * amount of removing "-ed" reaches "sat" from "sit" or "met" from
     * "meet". English has a few hundred of these and they are among the
     * commonest words in the language, so they have to be listed rather than
     * derived. Leaving them out meant "I met her and we sat down" produced
     * two false positives in eight words, which is precisely the behaviour
     * that gets a spell check switched off. */
    irregular:
      "ate awoke bade became began bent bet bit bled blew bore born bought " +
      "bound bred broke brought built burnt burst caught chose clung came " +
      "cost crept cut dealt did dove drank drew drove dug dwelt fed felt " +
      "fell fled flew flung forbade forgave forgot fought found froze gave " +
      "went got ground grew hid hit held hung hurt kept knelt knew laid led " +
      "leant leapt learnt left lent let lay lit lost made meant met mistook " +
      "mowed outdid overcame overtook paid proved put quit read rid rode " +
      "rang rose ran said saw sought sold sent set sewed shook shed shone " +
      "shot showed shrank shut sang sank sat slept slid slung smelt sowed " +
      "spoke sped spelt spent spilt spat split spread sprang stood stole " +
      "stuck stung stank strode struck strove swore swept swelled swam " +
      "swung took taught tore told thought threw thrust trod understood " +
      "undid upset woke wore wove wept won wound withdrew wrote " +
      "beaten begun bitten blown broken chosen done drawn driven drunk " +
      "eaten fallen flown forbidden forgiven forgotten frozen given gone " +
      "grown hidden known laden lain mistaken mown overdone proven ridden " +
      "risen sawn seen sewn shaken shown shrunk slain sown spoken sprung " +
      "stolen stricken striven sunk sworn swollen swum taken thrown trodden " +
      "withdrawn woven written",

    /* Short common nouns. Three-letter words are exactly the ones a
       frequency-ordered list under-represents and a caption uses constantly. */
    short:
      "ace ant arc arm art ash axe bag ban bar bat bay bed bee bell bin bit " +
      "boat bolt bone boot bow bowl box boy bud bug bulb bun bus cab cage " +
      "cake cap cart cave cell chin chip clay claw cliff cloth club coal " +
      "cob cod coil cord cork corn cot crab crew crop crow cub cube cue cup " +
      "curl dam dart dash dawn den dew dice dish dock doll dome dot dough " +
      "dove drum duck dusk dye eel elf elm fan fang fawn fee fern fig fin " +
      "fir flame flap flea fleet flock foam foe fog fold font fowl fur gale " +
      "gap gem germ gift gig gill glue goat gown grape grin grip gull gum " +
      "gut hall halt harm hawk hay haze heap heel hem hen herb herd hint " +
      "hip hive hoof hook hoop horn hose hum hut inn ivy jar jaw jet jug " +
      "keg kettle kid kit kite knob knot lace lad lamb lane lap lark lawn " +
      "lead ledge lid limb lime limp lion loaf lobe log loop lord lump lung " +
      "mane map mare mask mast mat maze mesh mess mist mite moat mole monk " +
      "moss moth mould mound mouse mud mug mule mum mushroom nap nest net " +
      "nib nook nut oak oar oath onion owl ox pad palm pan pane pawn pea " +
      "peak peel peg pest pet pew pie pier pile pill pit plough plug plum " +
      "pod pole pond pony pork port pouch prey pump pup rack raft rag raid " +
      "rake ram rat ray reed reef reel rib rib rim rind rink rink rip rod " +
      "rug rust sack sage sail sake salmon sap sash saw scar scarf seal " +
      "seam seed sheep shelf shrub silt sip skate sled slice slot slum " +
      "snail snake sofa sole sow spade span spark spear spine spire spite " +
      "sponge spool spray sprout spur squid stack staff stag stain stake " +
      "stalk stall steak stem stew sting stool stork stove strap straw " +
      "strip stud stump sum swamp swan swarm tack tag tan tank tap tar tart " +
      "tax teak teal thorn thread throne tick tide tile till tilt tip toad " +
      "toast toll tomb ton torch tow towel tower toy track tract tram trap " +
      "tray trim trot trough trunk tub tuft tug tusk twig twin urn van vane " +
      "vase veil vein vent vest vine vow wad wag wand ward wart wasp web " +
      "wedge weed well whale wharf wheat whip wick wig wisp witch wolf " +
      "worm wreck wrist yarn yawn yoke zone fox " +
      /* The halves that closed compounds are built from. Each earns its
         place several times over: "noon" gives afternoon, "hood" gives
         childhood and neighbourhood, "rise" gives sunrise. */
      "noon grand hood flake rise print scape pave roads motor stair " +
      "grave candle neighbor mid cliff shore scrap",

    // Words that are hard to spell and therefore worth having.
    tricky:
      "accommodate achieve acknowledge acquire address amateur apparent " +
      "argument assassin beginning believe bicycle broccoli bureau business " +
      "calendar camouflage category cemetery changeable colleague column " +
      "committee conscience conscious consensus curiosity definitely " +
      "desperate disappear disappoint discipline ecstasy embarrass " +
      "environment equipment exaggerate exceed exhilarate existence " +
      "experience familiar fascinate February fluorescent foreign gauge " +
      "government grammar grateful guarantee harass height hierarchy " +
      "humorous hygiene hypocrisy ignorance immediate independent " +
      "indispensable inoculate intelligence interrupt irresistible " +
      "jewellery judgement knowledge leisure liaison library licence " +
      "lightning maintenance manoeuvre marriage medieval millennium " +
      "miniature minuscule mischievous misspell necessary neighbour " +
      "nineteenth noticeable nuisance occasion occurrence omission " +
      "opportunity parallel parliament pastime perceive performance " +
      "permanent perseverance personnel playwright possession potato " +
      "precede preference privilege probably professional pronunciation " +
      "publicly questionnaire receipt receive recommend reference " +
      "referred relevant religious remember repetition restaurant rhyme " +
      "rhythm ridiculous sacrifice schedule scissors secretary separate " +
      "sergeant severely significant similar sincerely soldier speech " +
      "stationary stationery strength succeed successful sufficient " +
      "supersede surprise temperature tendency threshold tomorrow tongue " +
      "truly twelfth tyranny underrate until vacuum vehicle vicious " +
      "weather Wednesday weird whether withhold yacht"
  };

  /** Every word in the core list, lower-cased and de-duplicated. */
  function build() {
    var set = Object.create(null);
    Object.keys(GROUPS).forEach(function (g) {
      GROUPS[g].split(/\s+/).forEach(function (w) {
        var t = w.trim().toLowerCase();
        if (t) set[t] = true;
      });
    });
    return set;
  }

  var CORE = build();

  global.FlashyDict = {
    /** The built-in core, as a {word: true} table. */
    CORE: CORE,
    /** How many words it holds — reported in the dialog rather than claimed. */
    size: Object.keys(CORE).length,
    /** The groups, so the dialog can say what the core actually covers. */
    GROUPS: Object.keys(GROUPS),

    /**
     * Parse an imported word list.
     *
     * One word per line is the format every such list already uses. A line
     * with several words is split, because some lists are space-separated and
     * refusing them would be pedantry. Anything with a character English
     * words do not have is dropped rather than stored, so a stray CSV cannot
     * fill the dictionary with punctuation.
     */
    parse: function (text) {
      var out = Object.create(null), n = 0;
      String(text == null ? "" : text).split(/[\r\n]+/).forEach(function (line) {
        // A leading "#" is a comment in most word lists, and some carry a
        // "word/affix" form -- only the word matters here.
        var bare = line.replace(/^\s*#.*$/, "").split("/")[0];
        bare.split(/[\s,;\t]+/).forEach(function (w) {
          var t = w.trim().toLowerCase().replace(/^['"(\[]+|['")\].,!?:;]+$/g, "");
          if (!t || t.length > 40) return;
          if (!/^[a-z][a-z'-]*$/.test(t)) return;
          if (!out[t]) { out[t] = true; n++; }
        });
      });
      return { words: out, count: n };
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
