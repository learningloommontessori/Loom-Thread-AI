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
    
    // UPDATED PROMPT FOR PRIMARY SCHOOL (CLASS 1-5) STRUCTURE
    const systemPrompt = `You are "Loom Thread," an expert primary school curriculum designer (Grades 1-5). Create a highly engaging, structured lesson plan.
    Topic: "${topic}", Target Audience: "${age}" (approx 6-11 years old), Language: "${language}".

    You MUST return ONLY valid JSON.
    THE JSON STRUCTURE MUST BE EXACTLY THIS:
    {
      "lessonStarters": {
        "storyHook": "A short, creative original story (approx 100 words) to introduce the topic.",
        "wonderQuestion": "A provocative 'Did you know?' or 'What if?' question to spark curiosity immediately.",
        "realWorldConnection": "Explain how this topic connects to the child's daily life or home environment."
      },
      "activeLearning": {
        "handsOnExperiment": "A concrete, sensory-based activity using simple materials.",
        "groupGame": "A dynamic classroom game (charades, relay, etc.) that reinforces the concept.",
        "artIntegration": "A drawing, craft, or model-making task related to the topic."
      },
      "teachingGuide": {
        "blackboardSummary": ["List of 3-5 key points exactly as they should be written on the board."],
        "keyConceptAnalogies": "Simple comparisons to explain complex ideas (e.g., 'The heart is like a pump').",
        "misconceptionCheck": "Common mistakes students make with this topic and how to correct them."
      },
      "practiceAndAssess": {
        "worksheetIdeas": ["List 3 distinct ideas for worksheet questions (Fill in blanks, Match the following, etc)."],
        "exitTickets": ["List 3 quick questions to ask at the door to check understanding before class ends."],
        "homeConnect": "A fun, low-stress activity students can do at home with parents."
      },
      "inclusiveCorner": {
        "remedialSupport": "Specific tips for helping students who are struggling or learning slowly.",
        "challengeTasks": "Advanced 'Fast Finisher' questions or tasks for high-achieving students.",
        "multilingualBridges": "Key vocabulary words translated or explained to help bridge language gaps."
      },
      "valuesAndSkills": { 
        "valueOfTheDay": "A moral lesson or value (sharing, patience, teamwork) connected to this topic.", 
        "criticalThinkingQs": ["List 2 open-ended questions with no single right answer to provoke deep thought."]
      },
      "resourceHub": {
          "bookList": ["List 2-3 age-appropriate book titles."],
          "educationalVideos": ["List 2-3 specific search terms for educational YouTube videos."],
          "materialChecklist": ["List of all physical items needed for the activities above."]
      }
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