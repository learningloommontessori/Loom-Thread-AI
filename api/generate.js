// Path: /api/generate.js
import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
        status: 405, headers: { 'Content-Type': 'application/json' } 
    });
  }

  try {
    // 1. GET DATA (NOW INCLUDES AGE)
    const { topic, language, age } = await request.json(); // <--- Retrieving age
    
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) return new Response(JSON.stringify({ error: 'Token required' }), { status: 401 });
    
    const supabaseUserClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser(token);

    if (userError || !user) return new Response(JSON.stringify({ error: 'Invalid user' }), { status: 401 });

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!topic || !geminiApiKey) return new Response(JSON.stringify({ error: 'Topic required' }), { status: 400 });
    
    // 2. DYNAMIC SYSTEM PROMPT
    const systemPrompt = `You are KinderSpark AI, an expert assistant for kindergarten teachers.
    
    Topic: "${topic}"
    Target Audience: ${age || "Children aged 3-6"} 
    Language: Write strictly in ${language}.

    CRITICAL INSTRUCTION: Adapt all content for the "${age}" level.
    - Nursery (4-5): Simple words, sensory focus, gross motor.
    - Juniors (5-6): Patterns, sorting, early concepts.
    - Seniors (6-7): Abstract concepts, early math/reading, complex questions.

    Your response MUST be ONLY a valid, complete JSON object.
    {"newlyCreatedContent":{"originalRhyme": "...", "originalMiniStory": "..."},"newActivities":{"artCraftActivity": "...", "motorSkillsActivity": "...", "sensoryExplorationActivity": "..."},"movementAndMusic":{"grossMotorActivity": "...", "fineMotorActivity": "...", "actionSong": "..."},"socialAndEmotionalLearning":{"graceAndCourtesy": "...", "problemSolvingScenario": "..."},"classicResources":{"familiarRhymesAndSongs": ["..."], "classicStoryBooks": ["..."]},"montessoriConnections":{"traditionalUseOfMaterials": "...", "newWaysToUseMaterials": "..."},"teacherResources":{"observationCues": "...", "environmentSetup": "..."}}`;
    
    const textApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
    const textPayload = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: `Generate a Montessori lesson plan for: ${topic}` }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
    };
    
    const textApiResponse = await fetch(textApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(textPayload),
    });

    if (!textApiResponse.ok) throw new Error('AI generation failed.');
    
    const textData = await textApiResponse.json();
    const generatedText = textData.candidates?.[0]?.content?.parts?.[0]?.text;
    const lessonPlan = JSON.parse(generatedText.replace(/```json/g, '').replace(/```/g, '').trim());

    // 3. SAVE TO DATABASE (NOW INCLUDES AGE)
    const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    const { error: dbError } = await supabaseAdmin
      .from('AIGeneratedContent')
      .insert([{
          user_id: user.id,
          topic: topic,
          content_json: lessonPlan,
          language: language,
          age: age // <--- SAVING AGE
      }]);

    if (dbError) throw new Error(`Supabase error: ${dbError.message}`);
    
    return new Response(JSON.stringify({ lessonPlan }), { status: 200 });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}