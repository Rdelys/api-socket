const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
// Socket.IO avec CORS sécurisé
const io = socketIO(server, {
  cors: {
    origin: "https://livebeautyofficial.com/", // ✅ domaine à remplacer en prod
    methods: ["GET", "POST"],
    credentials: true
  },
  path: "/socket.io"
});

app.get('/', (req, res) => {
  res.send('✅ Serveur WebRTC Socket.IO avec traduction DeepL est en ligne');
});

/**
 * Configuration DeepL - CORRIGÉE
 */
const DEEPL_CONFIG = {
  API_KEY: 'e97d1e99-c844-4284-9654-56220dd7b994:fx', // Votre clé API
  API_URL: 'https://api-free.deepl.com/v2/translate',
  
  // Mapping des langues
  LANGUAGES: {
    'en': 'EN',
    'es': 'ES',
    'fr': 'FR',
    'de': 'DE',
    'it': 'IT',
    'nl': 'NL',
    'pl': 'PL',
    'pt': 'PT',
    'ru': 'RU',
    'ja': 'JA',
    'zh': 'ZH'
  }
};

/**
 * Service de traduction CORRIGÉ avec la bonne méthode axios
 */
class TranslationService {
  constructor() {
    this.apiKey = DEEPL_CONFIG.API_KEY;
    this.apiUrl = DEEPL_CONFIG.API_URL;
    this.languageMap = DEEPL_CONFIG.LANGUAGES;
    this.cache = new Map();
  }

  /**
   * Traduit un texte avec la bonne méthode DeepL
   */
  async translate(text, targetLang, sourceLang = null) {
    try {
      // Vérifications de base
      if (!text || typeof text !== 'string' || text.trim() === '') {
        console.log('⚠️ Texte vide ou invalide pour traduction');
        return text;
      }
      
      const trimmedText = text.trim();
      
      // Vérifier le cache
      const cacheKey = `${trimmedText}_${targetLang}_${sourceLang || 'auto'}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }
      
      // Limiter la longueur
      if (trimmedText.length > 5000) {
        console.warn('⚠️ Texte trop long pour traduction:', trimmedText.length);
        return text;
      }
      
      const targetLangCode = this.languageMap[targetLang];
      if (!targetLangCode) {
        console.warn(`⚠️ Langue cible non supportée: ${targetLang}`);
        return text;
      }

      console.log(`🌐 Traduction: ${sourceLang || 'auto'} -> ${targetLang} (${targetLangCode})`);
      
      // REQUÊTE CORRIGÉE avec la bonne méthode DeepL
      const response = await axios({
        method: 'POST',
        url: this.apiUrl,
        headers: {
          'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'YourApp/1.0.0'
        },
        data: {
          text: [trimmedText],
          target_lang: targetLangCode,
          ...(sourceLang && this.languageMap[sourceLang] && { source_lang: this.languageMap[sourceLang] })
        },
        timeout: 10000
      });

      if (response.data && response.data.translations && response.data.translations[0]) {
        const translatedText = response.data.translations[0].text;
        
        // Mettre en cache
        this.cache.set(cacheKey, translatedText);
        
        console.log(`✅ Traduction réussie: "${trimmedText.substring(0, 30)}..." -> "${translatedText.substring(0, 30)}..."`);
        return translatedText;
      }
      
      console.warn('⚠️ Réponse DeepL invalide:', response.data);
      return text;
      
    } catch (error) {
      // Gestion détaillée des erreurs
      if (error.response) {
        console.error(`❌ Erreur DeepL ${error.response.status}:`, {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          text: text ? text.substring(0, 50) : 'null'
        });
        
        // Messages d'erreur spécifiques
        if (error.response.status === 400) {
          console.error('🔧 Erreur 400 - Mauvais format de requête');
        } else if (error.response.status === 403) {
          console.error('🔐 Erreur 403 - Clé API invalide');
        } else if (error.response.status === 404) {
          console.error('🔍 Erreur 404 - URL API incorrecte');
        } else if (error.response.status === 413) {
          console.error('📏 Erreur 413 - Texte trop long');
        } else if (error.response.status === 429) {
          console.error('⏰ Erreur 429 - Trop de requêtes');
        } else if (error.response.status === 456) {
          console.error('💰 Erreur 456 - Quota dépassé');
        } else if (error.response.status >= 500) {
          console.error('🚨 Erreur serveur DeepL');
        }
      } else if (error.request) {
        console.error('🌐 Pas de réponse de DeepL - Vérifiez la connexion internet');
      } else {
        console.error('⚙️ Erreur configuration:', error.message);
      }
      
      return text; // Retourner le texte original en cas d'erreur
    }
  }

  /**
   * Détecte la langue d'un texte
   */
  async detectLanguage(text) {
    if (!text || text.trim() === '') return 'fr';
    
    try {
      const response = await axios({
        method: 'POST',
        url: this.apiUrl,
        headers: {
          'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          text: [text.trim().substring(0, 100)], // Limiter pour la détection
          target_lang: 'FR'
        },
        timeout: 5000
      });

      if (response.data && response.data.translations && response.data.translations[0]) {
        const detectedLang = response.data.translations[0].detected_source_language;
        if (detectedLang) {
          // Convertir "EN" -> "en", "FR" -> "fr"
          const langCode = detectedLang.toLowerCase();
          console.log(`🔍 Langue détectée: ${langCode} pour "${text.substring(0, 30)}..."`);
          return langCode;
        }
      }
      
      return 'fr';
      
    } catch (error) {
      console.error('❌ Erreur détection langue:', error.message);
      return 'fr';
    }
  }

  /**
   * Vérifie si une langue est supportée
   */
  isLanguageSupported(lang) {
    return lang in this.languageMap;
  }

  /**
   * Traduit un message selon le type d'utilisateur
   */
  async translateMessage(message, userType, userLanguage = null) {
    try {
      if (userType === 'modele') {
        // Modèle : toutes les langues → français
        if (userLanguage && userLanguage !== 'fr') {
          return await this.translate(message, 'fr', userLanguage);
        }
        return message;
      } else {
        // Client : français → langue du client
        if (userLanguage && userLanguage !== 'fr') {
          return await this.translate(message, userLanguage, 'fr');
        }
        return message;
      }
    } catch (error) {
      console.error('❌ Erreur translateMessage:', error.message);
      return message;
    }
  }

  /**
   * Teste la connexion à l'API DeepL
   */
  async testConnection() {
    try {
      const testText = "Hello, world!";
      const translated = await this.translate(testText, 'fr', 'en');
      
      if (translated !== testText) {
        console.log(`✅ Test DeepL OK: "${testText}" -> "${translated}"`);
        return true;
      } else {
        console.log('⚠️ Test DeepL: pas de traduction retournée');
        return false;
      }
    } catch (error) {
      console.error('❌ Test DeepL échoué:', error.message);
      return false;
    }
  }
}

// Initialiser le service
const translationService = new TranslationService();

/**
 * États du serveur
 */
let broadcasters = {};
let typingUsers = {};
let viewers = {};
let privateOwner = null;
let privateActive = false;
let userLanguages = {};

io.on("connection", socket => {
  console.log("📱 Client connecté:", socket.id);
  
  // Langue par défaut
  userLanguages[socket.id] = 'fr';

  // --- Définir la langue ---
  socket.on("set-language", (language) => {
    if (translationService.isLanguageSupported(language)) {
      userLanguages[socket.id] = language;
      console.log(`🌐 Langue définie pour ${socket.id}: ${language}`);
      
      // Répondre au client
      socket.emit("language-set", {
        success: true,
        language: language,
        message: `Langue définie sur ${language}`
      });
    } else {
      console.warn(`⚠️ Langue non supportée: ${language} pour ${socket.id}`);
      socket.emit("language-set", {
        success: false,
        error: `Langue ${language} non supportée`
      });
    }
  });

  // --- STOP LIVE ---
  socket.on("modele-stop-live", (data) => {
    const room = `public-${data.modele_id}`;
    console.log(`🛑 Modèle arrête le live dans ${room}`);
    io.to(room).emit("modele-stop-live", { modele_id: data.modele_id });
  });

  /**
   * === Broadcaster (modèle) ===
   */
  socket.on("broadcaster", (data = {}) => {
    const room = data.showPriveId 
      ? `prive-${data.showPriveId}`
      : `public-${data.modeleId}`;
    
    broadcasters[room] = socket.id;
    socket.join(room);
    
    // Le modèle est toujours en français
    userLanguages[socket.id] = 'fr';
    
    console.log(`🎥 Modèle ${socket.id} dans ${room} (mode: ${data.showPriveId ? 'privé' : 'public'})`);
    
    // Notifier les watchers
    socket.to(room).emit("broadcaster");
    
    // Gestion du temps pour les shows privés
    if (data.showPriveId && data.date && data.startTime && data.endTime) {
      const [endH, endM, endS] = data.endTime.split(":").map(Number);
      const [year, month, day] = data.date.split("-").map(Number);
      const endDate = new Date(year, month - 1, day, endH || 0, endM || 0, endS || 0, 0);
      const now = Date.now();
      
      if (endDate > now) {
        const durationMs = endDate - now;
        const durationMinutes = Math.floor(durationMs / (1000 * 60));
        
        io.to(room).emit("show-time", {
          showPriveId: data.showPriveId,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          endTimestamp: endDate.getTime(),
          durationMinutes: durationMinutes
        });

        console.log(`⏱️ Show privé ${room}: ${durationMinutes} minutes restantes`);
      } else {
        console.log(`⚠️ Show privé ${room} déjà terminé`);
      }
    }
  });

  /**
   * === Passage en show privé ===
   */
  socket.on("switch-to-private", async ({ pseudo }) => {
    console.log(`🔒 Passage en privé par ${pseudo} (${socket.id})`);
    
    privateOwner = socket.id;
    privateActive = true;

    // Expulser les autres viewers
    for (let [id, viewer] of Object.entries(viewers)) {
      if (viewer.room === "public" && id !== socket.id) {
        io.to(id).emit("redirect-dashboard");
        io.sockets.sockets.get(id)?.leave("public");
        delete viewers[id];
        console.log(`👋 ${viewer.pseudo} expulsé du public`);
      }
    }

    // Message système
    const systemMessage = `🚪 ${pseudo} a lancé un show privé`;
    
    // Diffuser le changement
    io.emit("switch-to-private", { 
      pseudo: pseudo,
      socketId: socket.id,
      timestamp: Date.now()
    });

    socket.join("private-" + pseudo);
    console.log(`✅ ${pseudo} en show privé`);
  });

  socket.on("cancel-private", async ({ pseudo }) => {
    console.log(`🔓 Annulation privé par ${pseudo}`);
    
    privateOwner = null;
    privateActive = false;
    socket.join("public");

    // Message système
    const systemMessage = `❌ ${pseudo} a annulé le show privé`;
    
    io.emit("cancel-private", { 
      pseudo: pseudo,
      timestamp: Date.now()
    });

    console.log(`✅ Retour au mode public`);
  });

  socket.on("join-public", ({ pseudo, language = 'fr' }) => {
    if (privateActive && socket.id !== privateOwner) {
      console.log(`⛔ ${pseudo} essaye de rejoindre mais privé actif`);
      io.to(socket.id).emit("redirect-dashboard");
    } else {
      socket.join("public");
      const validLanguage = translationService.isLanguageSupported(language) ? language : 'fr';
      viewers[socket.id] = { pseudo, room: "public", language: validLanguage };
      userLanguages[socket.id] = validLanguage;
      console.log(`👋 ${pseudo} rejoint public (${validLanguage})`);
    }
  });

  /**
   * === WebRTC relays ===
   */
  socket.on("offer", (id, description) => {
    socket.to(id).emit("offer", socket.id, description);
  });
  
  socket.on("answer", (id, description) => {
    socket.to(id).emit("answer", socket.id, description);
  });
  
  socket.on("candidate", (id, candidate) => {
    socket.to(id).emit("candidate", socket.id, candidate);
  });

  /**
   * === Watcher (client) ===
   */
  socket.on("watcher", async (data = {}) => {
    const room = data.showPriveId 
      ? `prive-${data.showPriveId}`
      : `public-${data.modeleId}`;
    
    const pseudo = data.pseudo || "Anonyme";
    const userLanguage = data.language || 'fr';
    
    // Valider la langue
    const validLanguage = translationService.isLanguageSupported(userLanguage) 
      ? userLanguage 
      : 'fr';
    
    socket.join(room);
    viewers[socket.id] = { room, pseudo, language: validLanguage };
    userLanguages[socket.id] = validLanguage;
    
    console.log(`👀 ${pseudo} (${validLanguage}) rejoint ${room}`);
    
    // Message d'accueil
    const welcomeMessage = `${pseudo} a rejoint le chat`;
    
    // Envoyer au nouveau client
    socket.emit("welcome-message", {
      message: welcomeMessage,
      language: validLanguage,
      room: room,
      timestamp: Date.now()
    });
    
    // Informer les autres
    socket.to(room).emit("viewer-connected", {
      socketId: socket.id,
      pseudo: pseudo,
      language: validLanguage,
      timestamp: Date.now()
    });
    
    // WebRTC avec le modèle
    if (broadcasters[room]) {
      socket.to(broadcasters[room]).emit("watcher", socket.id);
    }
  });

  /**
   * === CHAT avec traduction améliorée ===
   */
  socket.on("chat-message", async (data) => {
    const room = data.showPriveId 
        ? `prive-${data.showPriveId}`
        : `public-${data.modeleId}`;
    
    const senderId = socket.id;
    const senderLanguage = userLanguages[senderId] || 'fr';
    const isModel = data.isModel || false;
    
    console.log(`💬 Message de ${isModel ? 'modèle' : data.pseudo || 'client'} (${senderLanguage}): "${data.message.substring(0, 50)}${data.message.length > 50 ? '...' : ''}"`);
    
    try {
        // Messages système (pas de traduction)
        if (data.isSystem) {
            io.to(room).emit("chat-message", {
                ...data,
                timestamp: Date.now()
            });
            return;
        }

        if (isModel) {
            // ===== MESSAGE DU MODÈLE =====
            const modelMessage = data.message;
            const clientsInRoom = await io.in(room).fetchSockets();
            
            for (const clientSocket of clientsInRoom) {
                const clientId = clientSocket.id;
                const clientLanguage = userLanguages[clientId] || 'fr';
                
                if (clientLanguage === 'fr') {
                    // Client français → pas de traduction
                    clientSocket.emit("chat-message", {
                        ...data,
                        language: 'fr',
                        translated: false,
                        timestamp: Date.now()
                    });
                } else {
                    // Client étranger → traduire du français vers sa langue
                    try {
                        const translatedMessage = await translationService.translate(
                            modelMessage,
                            clientLanguage,
                            'fr'
                        );
                        
                        clientSocket.emit("chat-message", {
                            ...data,
                            message: translatedMessage,
                            originalMessage: modelMessage,
                            language: clientLanguage,
                            translated: true,
                            timestamp: Date.now()
                        });
                    } catch (translateError) {
                        // Erreur → envoyer version française
                        console.error(`❌ Erreur traduction pour ${clientId}:`, translateError.message);
                        clientSocket.emit("chat-message", {
                            ...data,
                            language: 'fr',
                            translated: false,
                            timestamp: Date.now()
                        });
                    }
                }
            }
            
            // Le modèle reçoit son propre message en français
            socket.emit("chat-message", {
                ...data,
                language: 'fr',
                translated: false,
                timestamp: Date.now()
            });
            
        } else {
            // ===== MESSAGE D'UN CLIENT =====
            const clientMessage = data.message;
            const senderLang = senderLanguage;
            
            // Récupérer tous les clients dans la salle
            const clientsInRoom = await io.in(room).fetchSockets();
            
            // Traduire pour chaque destinataire selon sa langue
            for (const clientSocket of clientsInRoom) {
                const clientId = clientSocket.id;
                const clientLanguage = userLanguages[clientId] || 'fr';
                
                if (clientId === senderId) {
                    // L'expéditeur voit son message dans sa langue d'origine
                    clientSocket.emit("chat-message", {
                        ...data,
                        language: senderLang,
                        translated: false,
                        timestamp: Date.now()
                    });
                    continue;
                }
                
                // Vérifier si c'est le modèle (toujours français)
                const isModelClient = clientId === broadcasters[room];
                
                if (isModelClient || clientLanguage === 'fr') {
                    // Destinataire français (modèle ou client) → traduire vers français si nécessaire
                    if (senderLang === 'fr') {
                        // Client français → pas de traduction
                        clientSocket.emit("chat-message", {
                            ...data,
                            language: 'fr',
                            translated: false,
                            timestamp: Date.now()
                        });
                    } else {
                        // Client étranger → traduire vers français
                        try {
                            const frenchMessage = await translationService.translate(
                                clientMessage,
                                'fr',
                                senderLang
                            );
                            
                            clientSocket.emit("chat-message", {
                                ...data,
                                message: frenchMessage,
                                originalMessage: clientMessage,
                                language: 'fr',
                                translated: true,
                                senderLanguage: senderLang,
                                timestamp: Date.now()
                            });
                        } catch (translateError) {
                            // Erreur → envoyer l'original
                            console.error(`❌ Erreur traduction vers français:`, translateError.message);
                            clientSocket.emit("chat-message", {
                                ...data,
                                language: senderLang,
                                translated: false,
                                error: "Traduction échouée",
                                timestamp: Date.now()
                            });
                        }
                    }
                } else {
                    // Destinataire étranger
                    if (senderLang === clientLanguage) {
                        // Même langue → pas de traduction
                        clientSocket.emit("chat-message", {
                            ...data,
                            language: clientLanguage,
                            translated: false,
                            timestamp: Date.now()
                        });
                    } else {
                        // Langues différentes → traduire vers la langue du destinataire
                        try {
                            const translatedMessage = await translationService.translate(
                                clientMessage,
                                clientLanguage,
                                senderLang
                            );
                            
                            clientSocket.emit("chat-message", {
                                ...data,
                                message: translatedMessage,
                                originalMessage: clientMessage,
                                language: clientLanguage,
                                translated: true,
                                senderLanguage: senderLang,
                                timestamp: Date.now()
                            });
                        } catch (translateError) {
                            // Erreur → envoyer l'original
                            console.error(`❌ Erreur traduction vers ${clientLanguage}:`, translateError.message);
                            clientSocket.emit("chat-message", {
                                ...data,
                                language: senderLang,
                                translated: false,
                                error: "Traduction échouée",
                                timestamp: Date.now()
                            });
                        }
                    }
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Erreur globale traitement message:', error);
        
        // Fallback ultime
        io.to(room).emit("chat-message", {
            ...data,
            error: "Erreur traitement",
            timestamp: Date.now()
        });
    }
});

  /**
   * === JETONS ===
   */
  socket.on("jeton-sent", async (data) => {
    const room = data.showPriveId 
      ? `prive-${data.showPriveId}`
      : `public-${data.modeleId}`;
    
    console.log(`💎 Jeton: ${data.pseudo} -> ${data.name} (${data.cost})`);
    
    // Message de base en français
    const jetonMessage = `${data.pseudo} a utilisé ${data.name} (${data.cost} jetons)`;
    
    // Envoyer d'abord la version française
    const baseData = {
      ...data,
      displayMessage: jetonMessage,
      timestamp: Date.now()
    };
    
    io.to(room).emit("jeton-sent", baseData);
    
    // Traductions supplémentaires pour les clients étrangers
    try {
      const clientsInRoom = await io.in(room).fetchSockets();
      
      for (const clientSocket of clientsInRoom) {
        const clientId = clientSocket.id;
        const clientLanguage = userLanguages[clientId] || 'fr';
        
        if (clientLanguage !== 'fr' && data.name) {
          try {
            const translatedName = await translationService.translate(
              data.name,
              clientLanguage,
              'fr'
            );
            
            const translatedMessage = `${data.pseudo} a utilisé ${translatedName} (${data.cost} jetons)`;
            
            clientSocket.emit("jeton-translated", {
              ...data,
              name: translatedName,
              displayMessage: translatedMessage,
              originalName: data.name,
              language: clientLanguage,
              timestamp: Date.now()
            });
          } catch (translateError) {
            // Ignorer les erreurs de traduction des jetons
          }
        }
      }
    } catch (error) {
      // Ignorer les erreurs pour les jetons
    }
  });

  /**
   * === SURPRISE ===
   */
  socket.on("surprise-sent", async (data) => {
    const room = data.showPriveId 
      ? `prive-${data.showPriveId}`
      : `public-${data.modeleId}`;
    
    console.log(`🎁 Surprise: ${data.pseudo} -> ${data.emoji} (${data.cost})`);
    
    // Message de base
    const surpriseMessage = `${data.pseudo} a envoyé ${data.emoji} (${data.cost} jetons)`;
    
    io.to(room).emit("surprise-sent", {
      ...data,
      displayMessage: surpriseMessage,
      timestamp: Date.now()
    });
  });

  /**
   * === Typing indicator ===
   */
  socket.on("typing", (data) => {
    typingUsers[socket.id] = data;
    const room = data.showPriveId 
      ? `prive-${data.showPriveId}`
      : `public-${data.modeleId}`;
    
    socket.to(room).emit("typing", {
      ...data,
      timestamp: Date.now()
    });
  });

  socket.on("stopTyping", (data = {}) => {
    delete typingUsers[socket.id];
    const room = data.showPriveId 
      ? `prive-${data.showPriveId}`
      : `public-${data.modeleId}`;
    socket.to(room).emit("stopTyping");
  });

  // client -> modele WebRTC
  socket.on('client-offer', (data) => {
    const room = data.showPriveId 
      ? `prive-${data.showPriveId}`
      : `public-${data.modeleId}`;
    const modeleSocketId = broadcasters[room];
    if (!modeleSocketId) {
      console.warn(`⚠️ Pas de modèle dans ${room} pour offre client`);
      return;
    }
    console.log(`📤 Offre client ${socket.id} -> modèle ${modeleSocketId}`);
    io.to(modeleSocketId).emit('client-offer', { 
      from: socket.id, 
      offer: data.offer,
      room: room
    });
  });

  socket.on('client-answer', (data) => {
    const target = data.toClientSocketId;
    if (target) {
      console.log(`📥 Réponse client ${socket.id} -> ${target}`);
      io.to(target).emit('client-answer', { 
        from: socket.id, 
        description: data.description 
      });
    }
  });

  socket.on('client-candidate', (data) => {
    if (data.to) {
      io.to(data.to).emit('client-candidate', { 
        candidate: data.candidate, 
        to: data.to 
      });
    } else if (data.toRoom) {
      const modeleSocketId = broadcasters[data.toRoom];
      if (modeleSocketId) {
        io.to(modeleSocketId).emit('client-candidate', { 
          candidate: data.candidate, 
          to: data.from 
        });
      }
    }
  });

  socket.on('client-stop', (data) => {
    const room = data.showPriveId 
      ? `prive-${data.showPriveId}`
      : `public-${data.modeleId}`;
    const modeleSocketId = broadcasters[room];
    if (modeleSocketId) {
      console.log(`🛑 Client ${socket.id} arrête caméra`);
      io.to(modeleSocketId).emit('client-disconnect', { 
        from: socket.id 
      });
    }
  });

  /**
   * === DÉCONNEXION ===
   */
  socket.on("disconnect", () => {
    console.log(`❌ Déconnexion: ${socket.id}`);
    
    // Nettoyage
    const userLang = userLanguages[socket.id];
    delete userLanguages[socket.id];
    
    if (viewers[socket.id]) {
      const { room, pseudo } = viewers[socket.id];
      io.to(room).emit("viewer-disconnected", {
        socketId: socket.id,
        pseudo: pseudo,
        timestamp: Date.now()
      });
      delete viewers[socket.id];
      console.log(`👋 ${pseudo} a quitté ${room}`);
    }
    
    // Si c'était un broadcaster (modèle)
    Object.entries(broadcasters).forEach(([room, broadcasterId]) => {
      if (broadcasterId === socket.id) {
        delete broadcasters[room];
        console.log(`⚠️ Modèle déconnecté de ${room}`);
        
        // Message de déconnexion
        const disconnectMessage = "Le modèle a quitté le live";
        io.to(room).emit("modele-deconnecte", {
          room: room,
          message: disconnectMessage,
          timestamp: Date.now()
        });
      }
    });
    
    // Typing
    if (typingUsers[socket.id]) {
      delete typingUsers[socket.id];
    }
    
    socket.broadcast.emit("disconnectPeer", socket.id);
  });
});

/**
 * === DÉMARRAGE DU SERVEUR ===
 */
const PORT = process.env.PORT || 3000;

// Tester la connexion DeepL au démarrage
translationService.testConnection().then(success => {
  if (success) {
    console.log('✅ DeepL API fonctionnelle');
  } else {
    console.log('⚠️ Problème avec DeepL API - les traductions peuvent échouer');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur Socket.IO sur http://0.0.0.0:${PORT}`);
  console.log(`🌐 Traduction DeepL: ${DEEPL_CONFIG.API_KEY ? '✅ Configurée' : '❌ Clé manquante!'}`);
  console.log(`📡 Prêt pour les connexions WebRTC et chat`);
});