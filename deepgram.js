const axios = require('axios');
exports.transcribe = async (audioBuffer) => {
  const res = await axios.post('https://api.deepgram.com/v1/listen', audioBuffer, {
    headers: {
      'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
      'Content-Type': 'audio/wav',
    },
  });
  return res.data.results.channels[0].alternatives[0].transcript;
};