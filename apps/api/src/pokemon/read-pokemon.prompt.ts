export const READ_POKEMON_PROMPT = `Lis uniquement les informations imprimées sur cette carte Pokémon physique.
Le nom est généralement en haut. La référence et le code d'extension sont généralement en bas à gauche,
mais peuvent se trouver à droite sur des cartes anciennes. Une deuxième image éventuelle est un gros plan
du bas de la même carte, pas une autre carte.
Retourne number (numérateur exact, avec zéros et préfixes comme TG, GG, SVP, SWSH), total (dénominateur
imprimé après /, ou null), name (nom complet exact avec ex, EX, GX, V, VMAX, etc.), language (FR, EN, JP
selon le texte imprimé, UNKNOWN si illisible) et set (code ou nom d'extension seulement s'il est lisible).
Ne confonds pas les PV, le numéro du Pokédex ou la lettre de régulation avec la référence ou l'extension.
Ne concatène pas un code d'extension séparé avec le numéro : chaque champ doit reproduire son inscription.
Ne devine jamais une référence, un nom ou une extension d'après l'illustration. Utilise null si illisible.
Ne compare aucune illustration et ne cherche pas à reconnaître une finition holo/reverse.
Si ce n'est pas une carte Pokémon physique, retourne tous les champs à null et language UNKNOWN.`;
