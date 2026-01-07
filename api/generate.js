// api/generate.js
import { createClient } from '@supabase/supabase-js';

// NOTE: We REMOVED "runtime: 'edge'" to use standard Node.js
// This fixes the "unsupported module" errors.

export default async function handler(req, res) {
  // 1. Handle CORS (Optional but good for debugging)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 2. GET DATA (Standard Node.js way: req.body)
    const { topic, language, age } = req.body;
    
    // Debugging: Check what is missing
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      console.error("Server Error: GEMINI_API_KEY is missing in Vercel Env Vars");
      return res.status(500).json({ error: 'Server misconfiguration: API Key missing' });
    }
    
    if (!topic) {
      return res.status(400).json({ error: 'Topic is missing from the request' });
    }

    // 3. AUTH CHECK
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Token required' });
    
    const supabaseUserClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser(token);

    if (userError || !user) return res.status(401).json({ error: 'Invalid user' });

    // 4. CALL GEMINI API
    // Using the stable model version
    const textApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
    
    const systemPrompt = `You are KinderSpark AI. Create a Montessori lesson plan for a ${age} level class.
    Topic: "${topic}"
    Language: "${language}"
    
    Return ONLY valid JSON. No markdown formatting. Structure:
    {
      "newlyCreatedContent": { "originalRhyme": "...", "originalMiniStory": "..." },
      "newActivities": { "artCraftActivity": "...", "practicalLifeActivity": "...", "sensorialActivity": "..." },
      "movementAndMusic": { "actionSong": "...", "mindfulnessExercise": "..." },
      "socialAndEmotionalLearning": { "groupDiscussionPrompt": "...", "empathyBuildingActivity": "..." },
      "teacherResources": { "keyVocabulary": ["..."], "materialChecklist": ["..."] },
      "classicResources": ["Resource 1", "Resource 2"],
      "montessoriConnections": { "philosophy": "..." }
    }`;

    const textPayload = {
        contents: [{
            role: "user",
            parts: [{ text: systemPrompt }]
        }],
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
    
    // Clean up response
    const cleanedText = generatedText.replace(/```json/g, '').replace(/```/g, '').trim();
    const lessonPlan = JSON.parse(cleanedText);

    // 5. SAVE TO DATABASE
    const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    const { error: dbError } = await supabaseAdmin
      .from('AIGeneratedContent')
      .insert([{
          user_id: user.id,
          topic: topic,
          content_json: lessonPlan,
          language: language,
          age: age
      }]);

    if (dbError) {
        console.error("DB Error:", dbError);
        // We don't fail the request if DB fails, just log it, or you can throw error
    }
    
    // 6. RETURN SUCCESS (Standard Node.js way)
    return res.status(200).json({ success: true, lessonPlan: lessonPlan });

  } catch (error) {
    console.error("Generate API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}