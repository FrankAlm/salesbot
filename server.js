require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { transcribe } = require('./deepgram');
const { askGPT } = require('./gpt');
const { speak } = require('./elevenlabs');

const app = express();
app.use(bodyParser.json());

app.post('/agent/offer_igniter', async (req, res) => {
  const audio = req.body.audioData;
  const config = {
    voice_id: "voice_id_abc",  // Hier deine ElevenLabs Voice-ID eintragen
    prompt: "Du bist ein Verkaufsberater für das Programm Offer Igniter. Sei freundlich, überzeugend und professionell."
  };

  try {
    const transcript = await transcribe(audio);
    const reply = await askGPT(transcript, config.prompt);
    const audioUrl = await speak(reply, config.voice_id);
    res.json({ audioUrl });
  } catch (err) {
    console.error(err);
    res.status(500).send("Fehler beim Verarbeiten des Audioeingangs.");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SalesBot läuft auf Port ${PORT}`);
});