const axios = require('axios');
const fs = require('fs');

exports.speak = async (text, voiceId) => {
  const res = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      text: text,
      model_id: "eleven_monolingual_v1",
      voice_settings: { stability: 0.5, similarity_boost: 0.8 }
    },
    {
      headers: {
        "xi-api-key": process.env.ELEVEN_API_KEY,
        "Content-Type": "application/json",
      },
      responseType: 'arraybuffer'
    }
  );

  const filename = `audio-${Date.now()}.mp3`;
  fs.writeFileSync(filename, res.data);
  return `http://your-server.com/${filename}`;
};