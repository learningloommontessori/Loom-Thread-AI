// api/generate.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { topic, language, age } = req.body;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    
    if (!geminiApiKey || !topic) return res.status(400).json({ error: 'Missing configuration' });

    // AUTH CHECK
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token required' });
    
    const supabaseUserClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Invalid user' });

    // CALL GEMINI (2.5 FLASH)
    const textApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
    
    // UPDATED PROMPT FOR SPECIFIC STRUCTURE
    const systemPrompt = `You are KinderSpark AI, an expert Montessori guide. Create a detailed lesson plan.
    Topic: "${topic}", Age: "${age}", Language: "${language}".

    You MUST return ONLY valid JSON.
    THE JSON STRUCTURE MUST BE EXACTLY THIS:
    {
      "newlyCreatedContent": {
        "originalRhyme": "Write a short, original rhyme about the topic.",
        "originalMiniStory": "Write a 3-4 sentence original story."
      },
      "newActivities": {
        "introductoryActivity": "A hook to introduce the topic.",
        "mainHandsOnActivity": "The core Montessori-style activity description."
      },
      "movementAndMusic": {
        "grossMotorActivities": ["List 2-3 activities involving large body movements related to topic."],
        "fineMotorActivities": ["List 2-3 activities for finger dexterity related to topic."],
        "suggestedSongs": ["List 2 known songs related to the topic."]
      },
      "montessoriConnections": {
        "traditionalWays": "Explain how Maria Montessori originally approached similar concepts.",
        "newWaysAdaptingToModernLife": "How this topic connects to modern child development while keeping Montessori principles."
      },
      "teacherResources": {
        "observationGuidelines": ["Specific things a teacher should look for during the activity."],
        "environmentSetup": ["How to prepare the shelf or room for this lesson."],
        "materialChecklist": ["List of physical items needed."]
      },
      "socialAndEmotionalLearning": { 
        "groupDiscussionPrompt": "Question to spark conversation.", 
        "empathyBuildingActivity": "Activity to build social skills." 
      },
      "classicResources": [
          { "title": "Name of a classic relevant book", "type": "Story Book", "youtubeLink": "(Generate a plausible YouTube search URL for read aloud)", "amazonLink": "(Generate a plausible Amazon search URL)" },
          { "title": "Name of a classic relevant rhyme/song", "type": "Rhyme/Song", "youtubeLink": "(Generate YouTube URL)", "amazonLink": "(Generate Amazon URL)" }
      ]
    }`;

    const textPayload = {
        contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
    };
    
    const textApiResponse = await fetch(textApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(textPayload),
    });

    if (!textApiResponse.ok) {
        const errText = await textApiResponse.text();
        throw new Error(`Gemini API Error: ${errText}`);
    }
    
    const textData = await textApiResponse.json();
    const generatedText = textData.candidates?.[0]?.content?.parts?.[0]?.text;
    const lessonPlan = JSON.parse(generatedText.replace(/```json/g, '').replace(/```/g, '').trim());

    // SAVE TO DB
    const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    await supabaseAdmin.from('AIGeneratedContent').insert([{
          user_id: user.id, topic: topic, content_json: lessonPlan, language: language, age: age
    }]);

    // RETURN WRAPPED RESPONSE
    return res.status(200).json({ success: true, lessonPlan: lessonPlan });

  } catch (error) {
    console.error("Generate API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}