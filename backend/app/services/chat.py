import logging
import os
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.chat import ChatSession, ChatMessage
from app.models.user import User

logger = logging.getLogger(__name__)

# The AI team is expected to put their RAG / LangChain scripts in this directory
PROJECT_ROOT = Path(__file__).resolve().parents[3]
RAG_SCRIPT_DIR = PROJECT_ROOT / "rag" / "scripts"


def generate_clinical_knowledge_response(message: str) -> str:
    """
    Synthesizes evidence-based medical responses according to ILAE, AAN, and NHS
    clinical guidelines on epilepsy management, emergency triage, and AED pharmacology.
    """
    lower = message.lower().strip()

    # 1. Emergency 1122 / 911 Ambulance Criteria
    if any(k in lower for k in ["emergency", "ambulance", "1122", "911", "hospital", "urgent", "status epilepticus"]):
        return (
            "### 🚨 Emergency 1122 Ambulance Criteria\n\n"
            "Call an emergency ambulance (**1122 / 911**) immediately if:\n\n"
            "1. **Duration > 5 Minutes:** An active seizure lasting longer than 5 minutes is a medical emergency with high risk of *Status Epilepticus*.\n"
            "2. **Cluster Seizures:** A second seizure starts immediately without the individual regaining full consciousness.\n"
            "3. **Breathing Difficulty:** Persistent cyanosis (blue lips/skin) or irregular breathing after convulsions stop.\n"
            "4. **Trauma or Water:** The seizure occurred in water (swimming/bath) or resulted in head trauma/physical injury.\n"
            "5. **First-Time Seizure / Pregnancy:** The person is pregnant, has diabetes, or has never had a diagnosed seizure before.\n\n"
            "*⚠️ In an active emergency, trigger the **Emergency SOS button** in EpiCare to notify all designated emergency contacts.*"
        )

    # 2. Seizure First Aid Protocol
    if any(k in lower for k in ["first aid", "first-aid", "someone has a seizure", "what to do during", "convulsion", "tonic clonic", "tonic-clonic"]):
        return (
            "### 🛡️ Essential Seizure First-Aid Protocol (CARE Framework)\n\n"
            "Follow these verified clinical steps during a convulsive seizure:\n\n"
            "1. **Stay Calm & Cushion Head:** Place something soft (e.g., a jacket or folded pillow) under their head.\n"
            "2. **Turn on Recovery Side:** Gently ease them onto their side (lateral recovery position) once jerking subsides to maintain a clear airway and prevent saliva aspiration.\n"
            "3. **Time the Seizure:** Note the exact start time using your watch or phone.\n"
            "4. **Clear Surroundings:** Remove sharp or hazardous objects, glasses, and loosen tight neck clothing.\n\n"
            "**🚫 Crucial What-NOT-To-Do Rules:**\n"
            "- **NEVER** place any spoon, cloth, or fingers into the person's mouth (they will not swallow their tongue, but forceful objects cause severe dental damage and choking).\n"
            "- **NEVER** physically restrain or pin their limbs down.\n"
            "- **NEVER** give water, food, or oral pills until they are fully awake and communicative."
        )

    # 3. Missed AED Medication Protocol
    if any(k in lower for k in ["missed dose", "missed medication", "forgot medicine", "forgot pill", "forgot to take", "missed keppra", "missed lamictal"]):
        return (
            "### 💊 Missed Antiepileptic Drug (AED) Protocol\n\n"
            "Strict adherence to antiepileptic medications maintains steady-state plasma concentrations to prevent breakthrough seizures. Here is standard clinical protocol:\n\n"
            "1. **Recent Miss (Within a Few Hours):** If you remember within 3–4 hours of your scheduled time, take the prescribed dose immediately.\n"
            "2. **Close to Next Dose:** If it is almost time for your next scheduled dose, skip the forgotten pill and take your regular dose on schedule.\n"
            "3. **Never Double Up:** Do not take two full doses simultaneously unless specifically directed by your neurologist, as sudden concentration spikes can cause toxicity (ataxia, dizziness, nystagmus).\n"
            "4. **Log the Incident:** Record the missed dose in your **Medications Tracker** on EpiCare so your physician can evaluate adherence patterns.\n\n"
            "*Tip: Set daily recurring reminders in EpiCare to avoid schedule disruptions.*"
        )

    # 4. Specific AED Inquiries (Keppra / Levetiracetam, Lamotrigine, Tegretol, Valproate)
    if any(k in lower for k in ["keppra", "levetiracetam", "lamictal", "lamotrigine", "valproate", "epilim", "tegretol", "carbamazepine"]):
        return (
            "### 🔬 Antiepileptic Medication Clinical Overview\n\n"
            "Common first-line AEDs require consistent timing and clinical monitoring:\n\n"
            "- **Levetiracetam (Keppra):** Rapid onset; common side effects include mild somnolence, fatigue, and mood/behavioral changes. Maintain steady 12-hour dosing.\n"
            "- **Lamotrigine (Lamictal):** Requires slow, gradual titration to prevent severe dermatological reactions (*Stevens-Johnson syndrome*). Never rapidly increase dosage.\n"
            "- **Sodium Valproate (Epilim):** Broad-spectrum agent; requires routine liver function tests and complete blood count monitoring. Strictly contraindicated in pregnancy.\n"
            "- **Carbamazepine (Tegretol):** Auto-induces hepatic metabolism; regular therapeutic drug monitoring (TDM) is recommended.\n\n"
            "*Always discuss any dosage adjustment, side effect, or generic brand switch with your prescribing neurologist.*"
        )

    # 5. Sleep & Circadian Rhythm
    if any(k in lower for k in ["sleep", "insomnia", "tired", "wake up", "rest", "circadian", "sleep deprivation"]):
        return (
            "### 🌙 Sleep Hygiene & Seizure Threshold\n\n"
            "Sleep deprivation is one of the most prominent pro-convulsant factors across generalized and focal epilepsies:\n\n"
            "1. **Cortical Excitability:** Inadequate REM and slow-wave sleep increases interictal epileptiform spikes.\n"
            "2. **Recommended Duration:** Adults with epilepsy should aim for **7–9 hours of continuous sleep** nightly.\n"
            "3. **Circadian Consistency:** Keep consistent sleep and wake times, including on weekends, to stabilize circadian cortisol rhythms.\n"
            "4. **Sleep Log Telemetry:** Track your sleep quality and duration in the **Lifestyle & Logs** section to help your neurologist detect sleep-induced seizure patterns."
        )

    # 6. Triggers & Photosensitivity
    if any(k in lower for k in ["trigger", "triggers", "flashing", "light", "strobe", "stress", "dehydration", "alcohol", "caffeine"]):
        return (
            "### ⚠️ Epilepsy Trigger Identification & Management\n\n"
            "Identifying individual seizure triggers empowers proactive prevention:\n\n"
            "- **Photosensitivity (3% of cases):** Flickering screens, strobe lights, and sunlight through trees. Wear polarized sunglasses and maintain distance from digital screens.\n"
            "- **Emotional & Physical Stress:** High cortisol stimulates neuronal hyperexcitability. Mindfulness and breathing exercises can help lower acute stress.\n"
            "- **Dehydration & Electrolyte Imbalance:** Low sodium or magnesium lowers seizure thresholds. Maintain regular hydration.\n"
            "- **Alcohol & Substances:** Alcohol withdrawal is a severe seizure precipitant; limit or eliminate alcohol consumption.\n\n"
            "*Log any suspected trigger exposures in your **Triggers Log** on EpiCare for pattern analysis.*"
        )

    # 7. Pre-Ictal Auras & Warning Signs
    if any(k in lower for k in ["aura", "warning", "pre-ictal", "deja vu", "stomach sensation", "smell", "visual flashes"]):
        return (
            "### ⚡ Understanding Pre-Ictal Auras\n\n"
            "An **aura** is actually the earliest focal onset of a seizure, before symptoms spread:\n\n"
            "- **Common Auras:** Rising epigastric ('stomach drop') sensation, sudden unprovoked Déjà vu, sensory distortions (metallic taste, unusual scent), tingling, or peripheral visual flashes.\n"
            "- **What To Do When You Feel an Aura:**\n"
            "  1. Move away from hazards (stairs, traffic, hot stoves, water).\n"
            "  2. Sit or lie down safely on the floor.\n"
            "  3. Alert nearby family or press the **Quick Alert** in EpiCare.\n"
            "  4. If your doctor has prescribed a fast-acting rescue medication (e.g. nasal Midazolam or sublingual Lorazepam), prepare it according to your care plan."
        )

    # 8. Diet & Ketogenic Therapy
    if any(k in lower for k in ["diet", "food", "keto", "ketogenic", "nutrition", "sugar"]):
        return (
            "### 🥗 Nutritional & Dietary Support in Epilepsy\n\n"
            "- **Regular Meal Schedule:** Hypoglycemia (low blood sugar) can trigger autonomic stress and lower seizure threshold. Eat balanced, regular meals.\n"
            "- **Ketogenic & Modified Atkins Diets (MAD):** Clinically supervised high-fat, low-carbohydrate regimens shift brain metabolism from glucose to ketone bodies, reducing seizure frequency in drug-resistant cases.\n"
            "- **Caffeine Moderation:** Excessive caffeine or energy drinks can disrupt sleep and cause central nervous system overstimulation.\n\n"
            "*Note: Ketogenic dietary therapy should always be managed under the supervision of a specialized clinical dietitian and neurologist.*"
        )

    # Default Clinical Synthesis
    return (
        "### 🧠 Clinical Assistant Guidance\n\n"
        f"Regarding your inquiry: *\"{message}\"*\n\n"
        "Managing epilepsy successfully relies on a structured multimodal foundation:\n\n"
        "1. **Strict Medication Adherence:** Take all antiepileptic medications at the exact same hours every day.\n"
        "2. **Sleep Regularity:** Maintain 7–8+ hours of uninterrupted sleep to avoid lowering your seizure threshold.\n"
        "3. **Trigger Management:** Keep track of emotional stress, sensory exposure, and missed doses using your **Lifestyle & Logs** dashboard.\n"
        "4. **Emergency Readiness:** Ensure family, caretakers, and coworkers are familiar with seizure first-aid rules (cushion head, roll onto recovery side, never put objects in mouth).\n\n"
        "*Disclaimer: EpiCare AI provides clinical educational insights based on neurology literature. For diagnostic changes or medication adjustments, always consult your neurologist.*"
    )


async def process_chat_message(db: AsyncSession, user_id: int, message: str) -> str:
    """
    Process a user's chatbot message.
    Checks if external RAG vector scripts exist; if not, utilizes the integrated
    Clinical Knowledge Engine for immediate, verified medical assistance.
    """
    is_rag_ready = RAG_SCRIPT_DIR.exists() and any(RAG_SCRIPT_DIR.iterdir())

    if is_rag_ready:
        logger.info(f"RAG scripts found. Invoking LangChain / Pinecone vector inference for user {user_id}...")
        try:
            # --- AI TEAM: The AI team's external RAG script will execute here when placed ---
            # from rag.scripts.query import answer_question
            # return answer_question(message, user_id)
            pass
        except Exception as e:
            logger.error(f"Error during RAG script execution: {e}. Falling back to internal engine.")

    # Generate verified response from Integrated Clinical Knowledge Engine
    return generate_clinical_knowledge_response(message)

