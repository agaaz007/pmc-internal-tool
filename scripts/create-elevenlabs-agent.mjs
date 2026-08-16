/**
 * Creates the FieldBrief bilingual site-reporting agent.
 * Run once: `node scripts/create-elevenlabs-agent.mjs`
 * The script prints only the new agent ID; it never prints the API key.
 */

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) throw new Error("ELEVENLABS_API_KEY is required");

const prompt = `# Role
You are Asha, FieldBrief's daily construction-site reporting assistant. You call project staff after their shift and collect a precise daily progress update for the head-office DPR.

# Language
- You are fluently bilingual in Indian English and natural Hindi/Hinglish.
- Start bilingual, then mirror the speaker's language. Code-switch naturally when they do.
- Do not translate their answer unless they ask. Preserve construction terminology, quantities, dates, floor numbers, drawing numbers, and vendor names exactly.
- Use respectful workplace language: "aap", never "tu".

# Voice behaviour
- This call may happen on a noisy live construction site. Ignore machinery, traffic, wind, coughing, sneezing, and unrelated background voices.
- Never treat a cough, sneeze, "hmm", "haan", or background shout as a complete answer or a request to end the call.
- Allow the person to interrupt you. Stop speaking, listen, then continue from the point they addressed.
- Ask one short question at a time. Keep every response under 22 words.
- If audio is unclear, say what specific detail you missed and ask only for that detail again.
- Read back safety incidents, blocker ownership, quantities, drawing/RFI numbers, and dates for confirmation. Do not repeatedly confirm ordinary details.
- If the person asks for a moment, wait silently. If there is no answer after a pause, gently prompt once in their current language.

# Runtime context
Contact: {{contact_name}}
Role: {{contact_role}}
Project: {{project_name}} ({{project_code}}), {{project_location}}
Date: {{report_date}}
Yesterday and prior context: {{previous_context}}
Open issues requiring follow-up: {{open_issues}}
Upcoming milestones: {{milestones}}

Treat runtime context as internal briefing. Never say you are reading from a database. You may refer naturally to a prior commitment: "Kal aapne kaha tha... uska kya update hai?"

# Call flow
1. After the opening disclosure, confirm it is a suitable time. If not, ask for a callback time and end politely.
2. Ask what work their team completed today. Probe once for measurable quantity, location, and activity when missing.
3. Follow up on relevant unresolved context from yesterday before moving on.
4. Ask for the biggest challenge today and its impact on cost, quality, safety, or schedule.
5. Ask what the team will complete tomorrow, with measurable target where possible.
6. Ask what could block tomorrow's plan, who owns the action, and by when it is needed.
7. Ask about safety incidents, near misses, unsafe conditions, or quality concerns. If there was an incident, collect location, time, people affected, immediate action, and escalation status without giving medical or legal advice.
8. Ask for manpower count and any critical material/equipment status if their role is relevant.
9. Summarize the 3–5 most important facts and ask for one confirmation: "Is that accurate? / Kya yeh sahi hai?"
10. Thank them and end the call. Do not keep chatting after the report is confirmed.

# Accuracy and escalation
- Never invent progress, quantities, dates, owners, or status.
- Distinguish completed work from planned work.
- A concern is not resolved unless the person explicitly says it is resolved.
- Flag contradictions with prior context neutrally and ask which status is current.
- For an emergency or active safety incident, tell the person to follow the site's emergency protocol and contact the responsible human immediately, then end after confirming they will do so.
- If someone other than {{contact_name}} answers, ask to speak to {{contact_name}}. Do not collect the DPR from an unverified person.
`;

const stringField = (description) => ({
  type: "string",
  description,
  enum: null,
  is_system_provided: false,
  dynamic_variable: "",
  allowed_values_dynamic_variable: "",
  constant_value: "",
  is_omitted: false,
});

const systemTool = (name, description, params) => ({
  type: "system",
  name,
  description,
  response_timeout_secs: 20,
  disable_interruptions: false,
  interruption_mode: "allow",
  force_pre_tool_speech: false,
  pre_tool_speech: "auto",
  assignments: [],
  tool_call_sound: null,
  tool_call_sound_behavior: "auto",
  tool_error_handling_mode: "auto",
  params,
});

const endCall = systemTool("end_call", "End after the report is confirmed, the contact declines, an emergency is handed off, or voicemail is detected.", { system_tool_type: "end_call" });
const skipTurn = systemTool("skip_turn", "Wait silently when the speaker asks for a moment or is briefly interrupted by site activity.", { system_tool_type: "skip_turn" });
const languageDetection = systemTool("language_detection", "Detect English, Hindi, and Hinglish throughout the call and mirror the speaker naturally.", { system_tool_type: "language_detection", only_at_conversation_start: false });
const voicemail = systemTool("voicemail_detection", "Detect voicemail and leave a short callback message.", { system_tool_type: "voicemail_detection", voicemail_message: "Namaste, this is Asha from FieldBrief calling for today's project update. We will try again shortly. Thank you." });

const body = {
  name: "FieldBrief — Daily Site Reporter",
  tags: ["fieldbrief", "construction", "daily-progress", "en-hi"],
  conversation_config: {
    asr: {
      quality: "high",
      provider: "scribe_realtime",
      user_input_audio_format: "pcm_16000",
      keywords: ["DPR", "RFI", "BOQ", "BBS", "MEP", "HVAC", "shuttering", "de-shuttering", "rebar", "scaffolding", "snag", "NOC", "PPE", "manpower", "concreting", "waterproofing", "AAC block", "cum", "square metre", "lakhs", "crores"],
    },
    turn: {
      turn_timeout: 14,
      silence_end_call_timeout: 120,
      mode: "turn",
      turn_eagerness: "patient",
      spelling_patience: "auto",
      speculative_turn: true,
      retranscribe_on_turn_timeout: true,
      turn_model: "turn_v3",
      interruption_ignore_terms: ["ahem", "cough", "coughing", "sneeze", "sneezing", "खाँसी", "छींक"],
      interruption_ignore_term_languages: ["en", "hi"],
      merge_with_default_ignore_terms: true,
      transcribe_on_disabled_interruptions: true,
      soft_timeout_config: {
        timeout_seconds: 2.2,
        message: "Ji, one moment.",
        additional_soft_timeout_messages: ["Haan ji."],
        use_llm_generated_message: false,
        randomize_fillers: true,
        max_soft_timeouts_per_generation: 1,
        disable_until_first_user_message: true,
      },
    },
    tts: {
      model_id: "eleven_v3_conversational",
      voice_id: "eXpIbVcVbLo8ZJQDlDnl",
      agent_output_audio_format: "pcm_16000",
      optimize_streaming_latency: 3,
      stability: 0.63,
      speed: 0.96,
      similarity_boost: 0.8,
      text_normalisation_type: "system_prompt",
      pronunciation_dictionary_locators: [],
    },
    conversation: {
      text_only: false,
      max_duration_seconds: 720,
      client_events: ["audio", "interruption", "user_transcript", "agent_response", "agent_response_correction"],
      monitoring_enabled: false,
      background_sound: { source_type: null, source_id: null, volume: 0.6, crossfade_loop: false },
    },
    agent: {
      first_message: "Namaste {{contact_name}}, main Asha, FieldBrief se bol rahi hoon. Yeh call daily progress reporting ke liye record hogi. Abhi do minute baat kar sakte hain?",
      language: "en",
      hinglish_mode: true,
      disable_first_message_interruptions: true,
      dynamic_variables: {
        dynamic_variable_placeholders: {
          contact_name: "site team member",
          contact_role: "project team",
          project_name: "the project",
          project_code: "PROJECT",
          project_location: "India",
          report_date: "today",
          previous_context: "No earlier context is available.",
          open_issues: "No open issue is assigned to this contact.",
          milestones: "No milestone follow-up is due.",
          contact_id: "unknown",
          project_id: "unknown",
        },
      },
      prompt: {
        prompt,
        llm: "gemini-2.5-flash",
        temperature: 0.2,
        max_tokens: 220,
        enable_parallel_tool_calls: false,
        tool_ids: [],
        built_in_tools: {
          end_call: endCall,
          language_detection: languageDetection,
          skip_turn: skipTurn,
          voicemail_detection: voicemail,
        },
        tools: [endCall, languageDetection, skipTurn, voicemail],
      },
    },
  },
  platform_settings: {
    data_collection: {
      work_completed: stringField("Work completed today, including measurable quantity and location. Preserve the speaker's language."),
      challenges: stringField("Biggest challenges today and their schedule, cost, quality, or safety impact."),
      tomorrow_plan: stringField("Measurable work planned for tomorrow."),
      blockers: stringField("Potential blockers for tomorrow, action owner, and required resolution date."),
      safety: stringField("Safety incidents, near misses, unsafe conditions, and immediate actions. Use 'none reported' only when explicitly confirmed."),
      manpower: stringField("Total manpower on site or for the speaker's package, including important trade breakdown if stated."),
      material_equipment: stringField("Critical material deliveries, shortages, equipment breakdowns, and recovery dates."),
      callback_time: stringField("Requested callback time if the contact could not complete the report."),
    },
    analysis_llm: "gemini-2.5-flash",
    sentiment_analysis: { enabled: true },
    privacy: {
      record_voice: true,
      retention_days: 365,
      delete_transcript_and_pii: false,
      delete_audio: false,
      apply_to_existing_conversations: false,
      zero_retention_mode: false,
      conversation_history_redaction: { enabled: false, entities: [] },
    },
  },
};

const response = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
  method: "POST",
  headers: { "content-type": "application/json", "xi-api-key": apiKey },
  body: JSON.stringify(body),
});

const result = await response.json();
if (!response.ok) {
  throw new Error(`ElevenLabs agent creation failed (${response.status}): ${JSON.stringify(result)}`);
}

console.log(result.agent_id);
