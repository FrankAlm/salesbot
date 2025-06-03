
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { transcribe } = require('./deepgram');
const { askGPT } = require('./gpt');
const { speak } = require('./elevenlabs');

const app = express();
app.use(bodyParser.json());

app.post('/agent/:id', async (req, res) => {
  const audio = req.body.audioData; // Simuliert Audiodaten von Twilio
  const agentId = req.params.id;
  const agentConfigs = require('./agent_configs.json');
  const config = agentConfigs[agentId];
  if (!config) return res.status(404).send("Agent not found");

  const transcript = await transcribe(audio);
  const reply = await askGPT(transcript, config.prompt);
  const audioUrl = await speak(reply, config.voice_id);
  res.json({ audioUrl });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot läuft auf Port ${PORT}`);
});
