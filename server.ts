import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);
  
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  app.use(express.json());

  // AI Endpoint for Gemini
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { messages, mode } = req.body;
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let responseText = '';
      if (mode === 'thinking') {
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: messages,
          config: {
            thinkingConfig: { thinkingLevel: 'HIGH' },
          }
        });
        responseText = response.text;
      } else if (mode === 'search') {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: messages,
          config: {
            tools: [{ googleSearch: {} }]
          }
        });
        responseText = response.text;
      } else {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: messages,
        });
        responseText = response.text;
      }
      
      res.json({ text: responseText });
    } catch (error: any) {
      console.error('AI Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Socket.io Signaling
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', ({ roomId, peerId }) => {
      socket.join(roomId);
      socket.to(roomId).emit('user-connected', peerId);
      
      socket.on('disconnect', () => {
        socket.to(roomId).emit('user-disconnected', peerId);
      });
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
