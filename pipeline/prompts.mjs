export const MODEL = 'Xenova/clip-vit-base-patch32';
// Image features are independent of text prompts, so prompts can change without redownloading art.
export const FEATURE_VERSION = 'clip-vit-b32-q8-oklab-v1';
export const MOODS = [
 ['serene','Serene',['a serene, peaceful fantasy painting','a tranquil scene with a calm and restful atmosphere','fantasy artwork evoking quiet harmony and stillness','a soothing, gentle scene of peace']],
 ['ominous','Ominous',['an ominous fantasy painting full of impending danger','a threatening scene with a sense of dread','fantasy artwork suggesting a terrible event is about to happen','a dark foreboding scene of menace']],
 ['triumphant','Triumphant',['a triumphant fantasy painting celebrating victory','a victorious hero in an uplifting scene of glory','fantasy artwork conveying courage, success and celebration','an exultant scene of heroic achievement']],
 ['melancholy','Melancholy',['a melancholy fantasy painting full of sadness','a lonely, wistful scene of loss and sorrow','fantasy artwork evoking grief, longing and nostalgia','a somber, poignant and mournful scene']],
 ['whimsical','Whimsical',['a whimsical, playful fantasy painting','a charming, quirky and fanciful scene','fantasy artwork with a lighthearted, humorous mood','a delightful, mischievous scene of magical fun']],
 ['violent','Violent',['a violent fantasy painting of brutal combat','an aggressive, chaotic scene of destruction and bloodshed','fantasy artwork showing fury, danger and physical conflict','a ferocious attack full of action and rage']],
 ['mysterious','Mysterious',['a mysterious fantasy painting full of secrets','an enigmatic scene of hidden magic and discovery','fantasy artwork evoking wonder, uncertainty and the unknown','an intriguing, mystical and secretive scene']],
 ['majestic','Majestic',['a majestic fantasy painting of awe and grandeur','an imposing, magnificent and regal scene','fantasy artwork with an epic sense of scale and splendor','a sublime scene of noble power and greatness']],
 ['eerie','Eerie',['an eerie, unsettling fantasy painting','a ghostly, haunting and uncanny scene','fantasy artwork evoking supernatural horror and unease','a creepy, otherworldly scene with a chilling atmosphere']],
 ['radiant','Radiant',['a radiant fantasy painting full of brilliant light','a luminous, glowing scene of warmth and hope','fantasy artwork evoking dazzling beauty and divine light','a resplendent scene bathed in golden magical light']],
 ['desolate','Desolate',['a desolate fantasy painting of bleak emptiness','a barren, abandoned and ruined scene','fantasy artwork evoking isolation, devastation and hopelessness','a lifeless, forsaken wasteland under a bleak sky']],
 ['tender','Tender',['a tender fantasy painting of love and affection','a gentle scene of caring, kindness and companionship','fantasy artwork evoking intimate warmth and emotional connection','a touching scene of compassion, comfort and protection']],
].map(([key,label,prompts])=>({key,label,prompts}));
export const SUBJECTS = [
 ['portrait','Portrait',["a close-up portrait of a person, showing their face and shoulders", "a fantasy character portrait, a face filling the picture", "a head-and-shoulders illustration of a human or humanoid"]],
 ['action','Figure or character',["a person or humanoid performing an action, casting magic or moving", "a fantasy illustration of a human warrior or wizard", "a full-body humanoid character in a pose"]],
 ['creature','Creature or monster',["a painting of a monster","an illustration of a mythical creature","a painting of a fantasy beast"]],
 ['animal','Animal',["a painting of an animal","an illustration of wildlife","a painting of a bird, mammal or fish"]],
 ['landscape','Landscape',["a landscape painting","an illustration of natural scenery","a painting of land and water"]],
 ['architecture','Architecture or city',["a painting of buildings, a castle, a temple or a city", "fantasy architecture and structures seen from outside", "a cityscape or an exterior view of a constructed place"]],
 ['battle','Battle scene',["an illustration of armies and multiple fighters in a large battle", "a fantasy war scene showing a group fighting against another group", "a crowded battlefield with opposing forces in combat"]],
 ['object','Object or artifact',["a painting of an object","an illustration of a weapon or artifact","a still life painting of an inanimate item"]],
 ['spell','Spell or abstract effect',["a painting of a magical spell","an abstract illustration of magical energy","a painting of a glowing magical effect"]],
 ['sky','Sky or cosmos',["a painting of outer space","an illustration of stars and planets","a painting of the sky and clouds"]],
 ['interior','Interior scene',["a painting of an indoor room, chamber, hall or dungeon", "a fantasy interior scene inside a building", "an illustration focused on an enclosed architectural space"]],
].map(([key,label,prompts])=>({key,label,prompts}));
