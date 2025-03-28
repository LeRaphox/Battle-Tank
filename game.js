// --- Initialisation ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Constantes ---
const MARGE = 30;
// IA retirée: const IA = false;

const window_width = 1370;
const window_height = 695;
canvas.width = window_width;
canvas.height = window_height;

const vitesse_rotation = 6;
const vitesse_tank = 6;
const vitesse_bullet = 8;

// --- État du jeu ---
let running = true;
let in_game = false;
let mode = 0; // 0: Classique, 1: Pièces, 2: Solo
let bullets = [];
let explosions = []; // N'est plus utilisé directement, on dessine direct
let temps_actuel = Date.now();
let lastTime = Date.now();
const keysPressed = {};
let ecran_mort_affiche = false;
let currentEndScreen = null;
// scoresFinPartie ne contiendra plus 'best'
let scoresFinPartie = null; // Sera { current: score } pour mode solo

// --- Stockage des Assets ---
const assets = {};
const assetPromises = [];

// --- Fonction de chargement d'image (retourne une Promesse) ---
function loadImage(src, name) {
    assetPromises.push(new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            console.log(`Image chargée: ${src}`);
            assets[name] = img;
            resolve(img);
        };
        img.onerror = (err) => {
            console.error(`ERREUR chargement image: ${src}`, err);
            reject(`Échec chargement ${src}`);
        };
        img.src = src;
        if (img.complete && img.naturalHeight !== 0) { img.onload(); }
        else if (img.complete && img.naturalHeight === 0) { img.onerror(); }
    }));
}

// --- Fonction de chargement audio (retourne une Promesse) ---
function loadAudio(src, name) {
    assetPromises.push(new Promise((resolve, reject) => {
        const audio = new Audio();
        audio.oncanplaythrough = () => {
            console.log(`Audio chargé: ${src}`);
            assets[name] = audio;
            resolve(audio);
        };
        audio.onerror = (err) => {
            console.error(`ERREUR chargement audio: ${src}`, err);
            reject(`Échec chargement ${src}`);
        };
        audio.src = src;
    }));
}

// --- Liste des assets à charger (VÉRIFIEZ LES CHEMINS/NOMS) ---
// Tanks & Bullet
loadImage("sprites/tank1.png", "tank1");
loadImage("sprites/tank2.png", "tank2");
loadImage("sprites/bullet.png", "bullet");
loadImage("sprites/explosion.png", "explosion");
// Backgrounds & UI
loadImage("sprites/back.jpg", "back");
loadImage("sprites/background.3.png", "menu_background");
loadImage("sprites/fleche.png", "fleche");
loadImage("sprites/coin.png", "coin");
// Scores 0-9
loadImage("sprites/0.png", "score0"); loadImage("sprites/1.png", "score1");
loadImage("sprites/2.png", "score2"); loadImage("sprites/3.png", "score3");
loadImage("sprites/4.png", "score4"); loadImage("sprites/5.png", "score5");
loadImage("sprites/6.png", "score6"); loadImage("sprites/7.png", "score7");
loadImage("sprites/8.png", "score8"); loadImage("sprites/9.png", "score9");
// Boutons Menu
loadImage("sprites/bois_classique_.png", "btn_classique");
loadImage("sprites/bois_classique.2.png", "btn_classique2");
loadImage("sprites/bois_piece.png", "btn_pieces");
loadImage("sprites/piece.2.png", "btn_pieces2");
loadImage("sprites/solo_bois.png", "btn_solo");
loadImage("sprites/solo_bois.2.png", "btn_solo2");
// Ecrans Fin
loadImage("sprites/tank1_victoire.jpg", "tank1_victoire");
loadImage("sprites/tank2_victoire.jpg", "tank2_victoire");
loadImage("sprites/fin_solo.jpg", "fin_solo");
// Sons
loadAudio("sons/jazz.mp3", "music_jazz");
loadAudio("sons/tir.mp3", "sound_tir");


// --- Message de chargement initial ---
ctx.fillStyle = 'black'; ctx.fillRect(0, 0, window_width, window_height);
ctx.fillStyle = 'white'; ctx.font = '30px Arial'; ctx.textAlign = 'center';
ctx.fillText("Chargement des assets...", window_width / 2, window_height / 2);
console.log("Début du chargement des assets...");

// --- Attente du chargement ---
Promise.all(assetPromises)
    .then(() => {
        console.log("--- Tous les assets sont chargés! Initialisation... ---");
        setupGame();
        requestAnimationFrame(gameLoop);
    })
    .catch((error) => {
        console.error("--- ERREUR MAJEURE lors du chargement d'assets ---", error);
        ctx.fillStyle = 'red'; ctx.fillRect(0, 0, window_width, window_height);
        ctx.fillStyle = 'white'; ctx.font = '24px Arial'; ctx.textAlign = 'center';
        ctx.fillText("Erreur chargement ressources.", window_width / 2, window_height / 2 - 30);
        ctx.fillText("Vérifiez la console (F12).", window_width / 2, window_height / 2 + 10);
        running = false;
    });


// --- Classes (Objet, Tank, Tir, Menu) ---
class Objet {
    constructor(imageName, x, y, angle = 0) {
        this.image = assets[imageName];
        if (!this.image) {
            console.error(`Image "${imageName}" non trouvée.`);
            this.width = 50; this.height = 50; this.placeholder = true;
        } else {
            this.width = this.image.width; this.height = this.image.height; this.placeholder = false;
        }
        this.x = x; this.y = y; this.angle = angle;
    }

    static objets_fonctions() {
        if (fleche) fleche.affiche();
        if (mode === 1 && coin) { coin.affiche(); }
    }

    affiche() {
        if (this.placeholder) {
            ctx.fillStyle = 'magenta'; // Placeholder différent
            ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
            return;
        }
        if (!this.image) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle * Math.PI / 180);
        ctx.drawImage(this.image, -this.width / 2, -this.height / 2, this.width, this.height);
        ctx.restore();
    }

    getRect() {
        return {
            x: this.x - this.width / 2, y: this.y - this.height / 2,
            width: this.width, height: this.height,
            centerX: this.x, centerY: this.y,
            right: this.x + this.width / 2, left: this.x - this.width / 2,
            top: this.y - this.height / 2, bottom: this.y + this.height / 2
        };
    }
     changer_position(x, y) { this.x = x; this.y = y; }
    collidepoint(pointX, pointY) {
        const rect = this.getRect();
        return pointX >= rect.left && pointX <= rect.right &&
               pointY >= rect.top && pointY <= rect.bottom;
    }
}

class Tank extends Objet {
    constructor(imageName, x, y, angle, vitesse, score_pos, cmdKeys, direction, num, ecrans_morts_names) {
        super(imageName, x, y, angle);
        this.original_imageName = imageName;
        this.original_center = { x: x, y: y };
        this.original_angle = angle;
        this.original_vitesse = vitesse;
        this.vitesse = this.original_vitesse;
        this.score_pos = score_pos;
        this.cmd = cmdKeys;
        this.direction = { ...direction };
        this.num = num; // 0 pour tank1, 1 pour tank2
        this.ecrans_morts = ecrans_morts_names;

        this.score = 0;
        this.explosion = false;
        this.temps_dernier_tir = 0;
        this.temps_explosion = 0;
        // temps_change_dir retiré (était pour l'IA)
    }

    // Paramètre is_ia retiré
    tanks_fontions() {
        this.change_direction(); // Appel sans is_ia
        // this.tire_ou_pas(); // Retiré, géré par keydown event
        this.move_tank();
        this.visualiser_score();
        this.affiche();
        if (this.explosion) {
            this.bloque_tank();
        }
        if (mode === 1) {
            this.verif_obj();
        }
        this.verif_bullet();
    }

    debut_partie() {
        if (mode === 0) { this.score = 5; } // Vies en mode classique
        else { this.score = 0; } // Score (pièces ou solo)
        this.reinitialiser_jeu(false); // Réinitialise position etc.
        if (tank1) tank1.temps_dernier_tir = Date.now();
        if (tank2) tank2.temps_dernier_tir = Date.now();
    }

    fin_partie() {
        in_game = false;
        ecran_mort_affiche = true;
        currentEndScreen = this.ecrans_morts[mode];

        // Logique meilleur score retirée
        if (mode === 2) {
            const joueurScore = tanks.find(t => t.num === 1)?.score || 0;
             // Stocke uniquement le score actuel pour l'affichage
             scoresFinPartie = { current: joueurScore };
        } else {
            scoresFinPartie = null;
        }
    }

    // Paramètre is_ia retiré
    change_direction() {
        temps_actuel = Date.now(); // Mettre à jour temps_actuel ici aussi

        // // Bloc IA retiré
        // if (is_ia) { ... }
        // else { ... } devient :

        // Contrôles Joueur (via l'objet global keysPressed)
        this.direction.forward = keysPressed[this.cmd.up] || false;
        this.direction.backward = keysPressed[this.cmd.down] || false;
        this.direction.left = keysPressed[this.cmd.left] || false; // Tourne à gauche
        this.direction.right = keysPressed[this.cmd.right] || false; // Tourne à droite
        // this.direction.fire n'est plus nécessaire ici, géré par keydown
    }

     move_tank() {
        if (this.vitesse === 0) return; // Ne pas bouger si bloqué

        // Rotation
        if (this.direction.right) { this.angle += vitesse_rotation; }
        if (this.direction.left) { this.angle -= vitesse_rotation; }
        this.angle = (this.angle % 360 + 360) % 360; // Garder entre 0 et 360

        // Calcul déplacement
        let dx = 0, dy = 0;
        const radAngle = this.angle * Math.PI / 180;

        if (this.direction.forward) {
            dx = Math.cos(radAngle) * this.vitesse;
            dy = Math.sin(radAngle) * this.vitesse;
        }
        if (this.direction.backward) {
            dx = -Math.cos(radAngle) * this.vitesse;
            dy = -Math.sin(radAngle) * this.vitesse;
        }

        this.x += dx;
        this.y += dy;

        // Collision avec les bords
        const approxHalfWidth = (this.width || 50) / 2;
        const approxHalfHeight = (this.height || 50) / 2;
        if (this.x + approxHalfWidth > window_width - MARGE) { this.x = window_width - MARGE - approxHalfWidth; }
        if (this.x - approxHalfWidth < MARGE) { this.x = MARGE + approxHalfWidth; }
        if (this.y + approxHalfHeight > window_height - MARGE) { this.y = window_height - MARGE - approxHalfHeight; }
        if (this.y - approxHalfHeight < MARGE) { this.y = MARGE + approxHalfHeight; }
    }

    // Fonction appelée par l'événement keydown directement
    try_fire() {
         temps_actuel = Date.now();
         if (temps_actuel - this.temps_dernier_tir >= 2000) { // 2 sec cooldown
            const tirSound = assets.sound_tir;
            if(tirSound) {
                tirSound.currentTime = 0;
                tirSound.play().catch(e => console.warn("Erreur lecture son tir:", e));
            }
            // En mode solo, le joueur (tank2, num=1) augmente son score en tirant
            if (mode === 2 && this.num === 1) {
                this.augmente_score();
            }
            const bullet = new Tir("bullet", this.x, this.y, vitesse_bullet, this.angle);
            bullets.push(bullet);
            this.temps_dernier_tir = temps_actuel;
        }
    }

    // // Fonction tire_ou_pas retirée (logique IA enlevée, joueur géré par keydown)
    // tire_ou_pas(is_ia) { ... }

    bloque_tank() {
        const explosionImg = assets.explosion;
        if (explosionImg) {
            const explosionSize = 100;
            ctx.drawImage(explosionImg, this.x - explosionSize / 2, this.y - explosionSize / 2, explosionSize, explosionSize);
        }
        this.vitesse = 0;
        temps_actuel = Date.now();
        if (temps_actuel - this.temps_explosion >= 1500) { // 1.5 sec
            this.debloque_tank();
        }
    }

    debloque_tank() {
        this.explosion = false;
        // Réinitialise position/vitesse. Ne clear PAS les bullets si mode != 0 (classique)
        this.reinitialiser_jeu(mode !== 0);
    }

    visualiser_score() {
        let score_str = this.score.toString();
        let display_x, display_y = 80; // Pos Y par défaut (modes 0, 1)

        if (mode !== 2) { // Mode Classique ou Pièces
            display_x = window_width / 2 + 150 * this.score_pos;
             if (this.score >= 0 && this.score <= 9) {
                const scoreImg = assets['score' + score_str];
                if (scoreImg) {
                    ctx.drawImage(scoreImg, display_x - scoreImg.width / 2, display_y - scoreImg.height / 2);
                } else { console.warn(`Image score manquante: score${score_str}`); }
            }
        } else { // Mode Solo (seul tank2 affiche son score en haut)
            if (this.num === 1) { // Seul le score du joueur (tank 2) est affiché
                display_y = 50; // Pos Y pour le mode solo
                let score_dizaines = Math.floor(this.score / 10);
                let score_unites = this.score % 10;

                const imgDizaines = assets['score' + score_dizaines];
                const imgUnites = assets['score' + score_unites];

                if (imgDizaines && imgUnites) {
                    const spacing = 10;
                    const totalWidth = imgDizaines.width + imgUnites.width + spacing;
                    let startX = window_width / 2 - totalWidth / 2;
                    ctx.drawImage(imgDizaines, startX, display_y);
                    ctx.drawImage(imgUnites, startX + imgDizaines.width + spacing, display_y);
                } else if (imgUnites) { // Score < 10 ou imgDizaines manque
                     ctx.drawImage(imgUnites, window_width / 2 - imgUnites.width / 2, display_y);
                     if(!imgDizaines && score_dizaines > 0) console.warn(`Img score manquante: score${score_dizaines}`);
                } else { console.warn(`Images score manquantes pour ${this.score}`); }
            }
        }
    }

    augmente_score() { // Gère vies (mode 0) et score (modes 1, 2)
        if (mode === 0) { // Mode classique (vies)
             if (this.score > 0) { this.score -= 1; }
        } else { // Mode pièces ou solo (score)
            this.score += 1;
        }
    }

     verif_obj() { // Mode pièces
        if (mode === 1 && coin) {
             const tankRect = this.getRect();
             const coinRect = coin.getRect();
             if (checkCollision(tankRect, coinRect)) {
                this.score += 1;
                const coinWidth = coin.width || 30;
                const coinHeight = coin.height || 30;
                coin.changer_position(
                    MARGE + coinWidth / 2 + Math.random() * (window_width - 2 * MARGE - coinWidth),
                    MARGE + coinHeight / 2 + Math.random() * (window_height - 2 * MARGE - coinHeight)
                );
                if (this.score >= 5) { this.fin_partie(); } // 5 pièces = victoire
            }
        }
    }

    reinitialiser_jeu(keepBulletsAndOtherTank = false) {
        this.x = this.original_center.x;
        this.y = this.original_center.y;
        this.angle = this.original_angle;
        this.vitesse = this.original_vitesse;
        this.explosion = false;

         if (!keepBulletsAndOtherTank) { // Réinitialisation complète (début partie classique)
             const otherTank = tanks.find(t => t !== this);
             if(otherTank) {
                otherTank.x = otherTank.original_center.x;
                otherTank.y = otherTank.original_center.y;
                otherTank.angle = otherTank.original_angle;
                otherTank.vitesse = otherTank.original_vitesse;
                otherTank.explosion = false;
             }
            bullets = []; // Vide la liste des projectiles
        }
         // Si keepBulletsAndOtherTank est true (après une explosion hors mode classique),
         // on ne touche pas à l'autre tank ni aux bullets.
    }

    verif_bullet() {
        const tankRect = this.getRect();
        temps_actuel = Date.now();

        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            const bulletRect = bullet.getRect();

            if (!this.explosion && checkCollision(tankRect, bulletRect)) {
                let gameShouldEnd = false;
                if (mode === 0) { // Classique: fin si vie <= 1
                    if (this.score <= 1) gameShouldEnd = true;
                } else if (mode === 2) { // Solo: fin si joueur (num=1) est touché
                    if (this.num === 1) gameShouldEnd = true;
                } // Mode 1 (Pièces): Pas de fin par tir

                if (gameShouldEnd) {
                    this.augmente_score(); // Met vie à 0 (mode 0) ou juste enregistre score (mode 2)
                    this.fin_partie();
                    bullets.splice(i, 1);
                } else { // Jeu continue (mode 0 avec vies restantes, ou mode 1)
                    this.augmente_score(); // Décrémente vie (mode 0), rien si mode 1
                    this.explosion = true;
                    this.temps_explosion = temps_actuel;
                    this.vitesse = 0;
                    bullets.splice(i, 1);
                }
                 break; // Un tank touché une fois par frame max
            }
        }
    }
}

class Tir extends Objet {
    constructor(imageName, x, y, speed, angle_tank) {
        const radAngle = angle_tank * Math.PI / 180;
        const startOffsetX = Math.cos(radAngle) * 50;
        const startOffsetY = Math.sin(radAngle) * 50;
        super(imageName, x + startOffsetX, y + startOffsetY, 0);

        this.speed = speed;
        this.dx = Math.cos(radAngle);
        this.dy = Math.sin(radAngle);
        this.rebondCooldown = 0;
    }

    bullet_fonctions() {
        this.move();
        this.affiche();
    }

    move() {
        temps_actuel = Date.now();
        if (this.rebondCooldown <= temps_actuel) {
            const approxHalfWidth = (this.width || 10) / 2;
            const approxHalfHeight = (this.height || 10) / 2;
            let bounced = false;

            if (this.x + approxHalfWidth > window_width - MARGE) {
                this.x = window_width - MARGE - approxHalfWidth; this.dx *= -1; bounced = true;
            } else if (this.x - approxHalfWidth < MARGE) {
                this.x = MARGE + approxHalfWidth; this.dx *= -1; bounced = true;
            }
            if (this.y + approxHalfHeight > window_height - MARGE) {
                this.y = window_height - MARGE - approxHalfHeight; this.dy *= -1; bounced = true;
            } else if (this.y - approxHalfHeight < MARGE) {
                this.y = MARGE + approxHalfHeight; this.dy *= -1; bounced = true;
            }
            if (bounced) { this.rebondCooldown = temps_actuel + 100; } // 100ms cooldown
        }
        this.x += this.dx * this.speed;
        this.y += this.dy * this.speed;
    }
}

class Menu {
     constructor(backgroundName, boutonsNames) {
        this.background = assets[backgroundName];
        this.boutonsNormal = [
            new Objet(boutonsNames.classique, window_width / 2 + 100, window_height / 2 - 25),
            new Objet(boutonsNames.pieces, window_width / 2 + 100, window_height / 2 + 100),
            new Objet(boutonsNames.solo, window_width / 2 + 100, window_height / 2 + 225)
        ];
        this.boutonsSelected = [
             new Objet(boutonsNames.classique2, window_width / 2 + 100, window_height / 2 - 25),
             new Objet(boutonsNames.pieces2, window_width / 2 + 100, window_height / 2 + 100),
             new Objet(boutonsNames.solo2, window_width / 2 + 100, window_height / 2 + 225)
        ];
        this.temps_change_boutons = 0;
        this.selectedIndex = 0;
    }

    change_affiche_boutons() {
         temps_actuel = Date.now();
        if (temps_actuel - this.temps_change_boutons > 200) { // 200ms délai
            let changed = false;
            if (keysPressed['ArrowUp']) { this.selectedIndex--; changed = true; }
            if (keysPressed['ArrowDown']) { this.selectedIndex++; changed = true; }
            if (changed) {
                this.selectedIndex = (this.selectedIndex % 3 + 3) % 3; // Boucle 0,1,2
                this.temps_change_boutons = temps_actuel;
            }
        }

        // Affichage fond
        if (this.background) { ctx.drawImage(this.background, 0, 0, window_width, window_height); }
        else { ctx.fillStyle = 'grey'; ctx.fillRect(0, 0, window_width, window_height); }

        // Affichage boutons
        for (let i = 0; i < 3; i++) {
            const btnNormal = this.boutonsNormal[i];
            const btnSelected = this.boutonsSelected[i];
            if(i === this.selectedIndex && btnSelected) { btnSelected.affiche(); }
            else if (btnNormal) { btnNormal.affiche(); }
        }
         // Instructions Menu
         ctx.fillStyle = 'white'; ctx.font = '20px Arial'; ctx.textAlign = 'center';
         ctx.fillText("Utilisez HAUT/BAS pour sélectionner", window_width / 2, window_height - 100);
         ctx.fillText("Appuyez sur ESPACE pour commencer", window_width / 2, window_height - 60);
    }
}

// --- Initialisation des objets globaux (sera fait dans setupGame) ---
let tank1, tank2, tanks = [], img_back, fleche, coin, menu;

// --- Fonction d'initialisation (appelée après chargement des assets) ---
function setupGame() {
    console.log("Exécution de setupGame()...");
    img_back = assets.back ? new Objet("back", window_width / 2, window_height / 2) : null;
    fleche = assets.fleche ? new Objet("fleche", 100, 100) : null;
    const coinX = MARGE + 15 + Math.random() * (window_width - 2 * MARGE - 30);
    const coinY = MARGE + 15 + Math.random() * (window_height - 2 * MARGE - 30);
    coin = assets.coin ? new Objet("coin", coinX, coinY) : null;

    // Crée les tanks s'ils sont chargés
    tank1 = assets.tank1 ? new Tank("tank1", 100, window_height - 100, 0, vitesse_tank, -1,
                     { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', fire: 'ShiftLeft' },
                     { forward: false, backward: false, left: false, right: false }, 0, // dir.fire enlevé
                     ["tank2_victoire", "tank2_victoire", "fin_solo"]) : null;

    tank2 = assets.tank2 ? new Tank("tank2", window_width - 100, 100, 180, vitesse_tank, 1,
                     { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', fire: 'Space' },
                     { forward: false, backward: false, left: false, right: false }, 1, // dir.fire enlevé
                     ["tank1_victoire", "tank1_victoire", "fin_solo"]) : null;

    // Liste des tanks réellement créés
    tanks = [tank1, tank2].filter(t => t !== null);

    // Menu
    const boutonsData = {
        classique: "btn_classique", classique2: "btn_classique2",
        pieces: "btn_pieces", pieces2: "btn_pieces2",
        solo: "btn_solo", solo2: "btn_solo2"
    };
    menu = assets.menu_background ? new Menu("menu_background", boutonsData) : null;
    if (!menu) console.error("Impossible d'initialiser le menu (img fond manquante?).");

    // Musique
    const music = assets.music_jazz;
    if (music) {
        music.loop = true; music.volume = 0.3;
        music.play().catch(e => { console.warn("Lecture auto musique bloquée.", e); });
    }
    console.log("setupGame() terminé.");
}

// --- Fonctions Utilitaires ---
function checkCollision(rect1, rect2) {
    if (!rect1 || !rect2) return false;
    return rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y;
}

// Fonction drawScore simplifiée (plus de paramètre isBest)
function drawScore(scoreValue, x, y) {
     const scoreStr = scoreValue.toString().padStart(2, '0'); // Ex: "05"
     const digit1 = scoreStr[0];
     const digit2 = scoreStr[1];
     const img1 = assets['score' + digit1];
     const img2 = assets['score' + digit2];

     if (img1 && img2) {
         const spacing = 10;
         ctx.drawImage(img1, x, y);
         ctx.drawImage(img2, x + img1.width + spacing, y);
     } else { // Fallback texte
         console.warn(`Impossible d'afficher ${scoreValue} avec images.`);
         ctx.fillStyle = 'white';
         ctx.font = '40px Arial';
         ctx.fillText(scoreValue.toString(), x, y + 40);
     }
}

// --- Gestion des Événements (Input) ---
window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft'].includes(e.code)) {
        e.preventDefault();
    }
    keysPressed[e.code] = true;

    // Espace: Lancer jeu / Rejouer / Tirer (T2)
    if (e.code === 'Space') {
        if (!in_game && !ecran_mort_affiche && menu) { // Menu -> Jeu
            mode = menu.selectedIndex;
            // Vérification si tanks nécessaires sont présents
            if (mode !== 2 && tanks.length < 2) {
                 console.error("Mode 2 joueurs impossible: un tank manque."); return;
            }
            if (mode === 2 && !tank2) {
                 console.error("Mode solo impossible: tank 2 manque."); return;
            }
            in_game = true;
            ecran_mort_affiche = false;
            tanks.forEach(tank => tank?.debut_partie()); // Appelle debut_partie si tank existe
        } else if (ecran_mort_affiche) { // Fin -> Jeu
            ecran_mort_affiche = false;
            in_game = true;
            tanks.forEach(tank => tank?.debut_partie());
        } else if (in_game && tank2 && tank2.cmd.fire === 'Space') { // Tir T2
             tank2.try_fire();
        }
    }
     // Tir T1 (Shift Gauche)
    if (in_game && e.code === tank1?.cmd.fire) { // Vérifie si tank1 existe
        tank1.try_fire();
    }
});

window.addEventListener('keyup', (e) => {
    keysPressed[e.code] = false;
});

canvas.addEventListener('click', (e) => {
    // Essayer de démarrer la musique au clic si elle est en pause
    const music = assets.music_jazz;
    if (music && music.paused) {
        music.play().catch(err => console.warn("Clic: Impossible démarrer musique:", err));
    }

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Clic flèche retour (si elle existe)
    if ((in_game || ecran_mort_affiche) && fleche?.collidepoint(clickX, clickY)) {
        in_game = false;
        ecran_mort_affiche = false;
        bullets = [];
    }
});

// --- Boucle de Jeu Principale ---
function gameLoop(timestamp) {
    temps_actuel = Date.now();

    ctx.clearRect(0, 0, window_width, window_height); // Effacer

    if (in_game) {
        // --- Mode Jeu ---
        if (img_back) img_back.affiche();
        else { ctx.fillStyle = '#333'; ctx.fillRect(0,0,window_width, window_height); }

        // Màj et affichage tanks (contrôlés par joueurs)
         if (mode !== 2) { // Modes 0 (Classique) et 1 (Pièces) -> 2 joueurs
             tank1?.tanks_fontions(); // Appel sans is_ia
             tank2?.tanks_fontions(); // Appel sans is_ia
         } else { // Mode 2 (Solo) -> Joueur 2 uniquement
              tank2?.tanks_fontions(); // Appel sans is_ia
              // Tank1 n'est ni mis à jour ni affiché
         }

        // Màj et affichage balles
        for (let i = bullets.length - 1; i >= 0; i--) {
            bullets[i].bullet_fonctions();
        }

        // Affichage objets (flèche, pièce si mode 1)
        Objet.objets_fonctions();

    } else if (ecran_mort_affiche) {
        // --- Mode Ecran Fin ---
         const endScreenImg = assets[currentEndScreen];
         if (endScreenImg) { ctx.drawImage(endScreenImg, 0, 0, window_width, window_height); }
         else { /* Fond noir + Texte Fin si image manque */ }

        // Afficher score actuel (mode solo seulement)
        if (mode === 2 && scoresFinPartie) {
             // Position approx. du score Python
             drawScore(scoresFinPartie.current, 662, 100);
             // Affichage Best Score retiré
        }

        fleche?.affiche(); // Afficher flèche si existe

        // Instructions fin
         ctx.fillStyle = 'white'; ctx.font = '20px Arial'; ctx.textAlign = 'center';
         ctx.fillText("Appuyez sur ESPACE pour rejouer", window_width / 2, window_height - 100);
         ctx.fillText("Cliquez sur la flèche pour retourner au menu", window_width / 2, window_height - 60);

    } else if (menu) { // Si Menu existe
        // --- Mode Menu ---
        menu.change_affiche_boutons();
    } else {
        // --- Erreur chargement Menu ---
        /* Affichage message erreur */
    }

    if (running) { requestAnimationFrame(gameLoop); } // Prochaine frame
}

// --- Démarrage ---
// Promise.all lance le jeu après chargement.