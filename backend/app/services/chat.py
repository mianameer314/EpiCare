"""
Chat service — provides evidence-grounded educational epilepsy guidance,
emergency safety triage, and dynamic hookups for future RAG AI pipelines (Finding 10).
"""
import logging
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Dynamic RAG script directory (relative to project root)
PROJECT_ROOT = Path(__file__).resolve().parents[3]
RAG_DIR = PROJECT_ROOT / "rag"
RAG_SCRIPT_DIR = RAG_DIR / "scripts"

# Auto-ensure directory exists so future AI team code drops work immediately
try:
    RAG_SCRIPT_DIR.mkdir(parents=True, exist_ok=True)
except Exception as e:
    logger.debug(f"Note: RAG script directory creation: {e}")


def generate_clinical_knowledge_response(message: str) -> str:
    """
    Synthesizes evidence-based educational responses according to ILAE, AAN, and NHS
    clinical guidelines on epilepsy management, emergency triage, and AED pharmacology.
    """
    lower = message.lower().strip()

    # 1. Acute Emergency / Ambulance Protocol / Active Seizure Alert
    if any(k in lower for k in [
        "seizure right now", "having a seizure", "active seizure", "emergency",
        "ambulance", "1122", "911", "hospital", "urgent", "status epilepticus",
        "can't breathe", "cannot breathe", "unconscious"
    ]):
        return (
            "### 🚨 IMMEDIATE EMERGENCY & AMBULANCE PROTOCOL\n\n"
            "**If a seizure is actively occurring or lasting more than 5 minutes, call emergency services immediately (1122 in Pakistan / 911 in US/Intl).**\n\n"
            "#### ⚡ Immediate First-Aid Steps (CARE):\n"
            "1. **Protect Head:** Place something soft under the head.\n"
            "2. **Recovery Position:** Roll gently onto the lateral side once convulsions ease to keep the airway open.\n"
            "3. **Time Duration:** Note the exact start time of the seizure.\n"
            "4. **DO NOT Restrain:** Never pin the limbs down or place anything inside the mouth.\n\n"
            "🚨 **Action Required:** Tap the **Emergency SOS button** in EpiCare immediately to alert your designated caretakers and dispatch emergency location alerts."
        )

    # 2. Medication Dosage Change Refusal Guard (Clinical Safety Boundary)
    if any(k in lower for k in [
        "how much should i take", "change my dose", "increase my dose", "decrease my dose",
        "prescribe me", "what dose of", "how many mg should i take"
    ]):
        return (
            "### ⚠️ Medication Prescription & Dosage Safety Notice\n\n"
            "**EpiCare AI cannot calculate, change, or prescribe individualized medication dosages.**\n\n"
            "- Antiepileptic drug (AED) dosages require precise clinical titration based on serum drug levels, renal/hepatic function, seizure frequency, and co-medications.\n"
            "- **Required Action:** Please contact your verified doctor directly through your **Care Network** in EpiCare or schedule an in-person clinical consultation before modifying any medication schedule."
        )

    # 3. Seizure First Aid Protocol
    if any(k in lower for k in ["first aid", "first-aid", "someone has a seizure", "what to do during", "convulsion", "tonic clonic", "tonic-clonic"]):
        return (
            "### 🛡️ Essential Seizure First-Aid Protocol (CARE Framework)\n\n"
            "Follow these verified clinical steps during a convulsive seizure:\n\n"
            "1. **Stay Calm & Cushion Head:** Place something soft (e.g., a jacket or folded pillow) under their head.\n"
            "2. **Turn on Recovery Side:** Gently ease them onto their side (lateral recovery position) once jerking subsides to maintain a clear airway and prevent saliva aspiration.\n"
            "3. **Time the Seizure:** Note the exact start time using your watch or phone.\n"
            "4. **Clear Surroundings:** Remove sharp or hazardous objects, glasses, and loosen tight neck clothing.\n\n"
            "**🚫 Crucial What-NOT-To-Do Rules:**\n"
            "- **NEVER** place any spoon, cloth, or fingers into the person's mouth.\n"
            "- **NEVER** physically restrain or pin their limbs down.\n"
            "- **NEVER** give water, food, or oral pills until they are fully awake and communicative."
        )

    # 4. Missed AED Medication Protocol
    if any(k in lower for k in ["missed dose", "missed medication", "forgot medicine", "forgot pill", "forgot to take", "missed keppra", "missed lamictal"]):
        return (
            "### 💊 Missed Antiepileptic Drug (AED) Protocol\n\n"
            "Strict adherence to antiepileptic medications maintains steady-state plasma concentrations to prevent breakthrough seizures:\n\n"
            "1. **Recent Miss (Within a Few Hours):** If you remember within 3–4 hours of your scheduled time, take the prescribed dose immediately.\n"
            "2. **Close to Next Dose:** If it is almost time for your next scheduled dose, skip the forgotten pill and take your regular dose on schedule.\n"
            "3. **Never Double Up:** Do not take two full doses simultaneously unless specifically directed by your neurologist, as sudden concentration spikes can cause toxicity (ataxia, dizziness, nystagmus).\n"
            "4. **Log the Incident:** Record the missed dose in your **Medications Tracker** on EpiCare so your physician can evaluate adherence patterns."
        )

    # 5. Specific AED Inquiries (Keppra / Levetiracetam, Lamotrigine, Tegretol, Valproate)
    if any(k in lower for k in ["keppra", "levetiracetam", "lamictal", "lamotrigine", "valproate", "epilim", "tegretol", "carbamazepine"]):
        return (
            "### 🔬 Antiepileptic Medication Educational Overview\n\n"
            "Common first-line AEDs require consistent timing and clinical monitoring:\n\n"
            "- **Levetiracetam (Keppra):** Rapid onset; common side effects include mild somnolence, fatigue, and behavioral changes. Maintain steady 12-hour dosing.\n"
            "- **Lamotrigine (Lamictal):** Requires slow, gradual titration to prevent severe dermatological reactions (*Stevens-Johnson syndrome*). Never rapidly increase dosage.\n"
            "- **Sodium Valproate (Epilim):** Broad-spectrum agent; requires routine liver function and CBC monitoring. Strictly contraindicated in pregnancy.\n"
            "- **Carbamazepine (Tegretol):** Auto-induces hepatic metabolism; regular therapeutic drug monitoring (TDM) is recommended.\n\n"
            "*Always discuss any dosage adjustment, side effect, or generic brand switch with your prescribing neurologist.*"
        )

    # 6. Sleep & Circadian Rhythm
    if any(k in lower for k in ["sleep", "insomnia", "tired", "wake up", "rest", "circadian", "sleep deprivation"]):
        return (
            "### 🌙 Sleep Hygiene & Seizure Threshold\n\n"
            "Sleep deprivation is one of the most prominent pro-convulsant factors across generalized and focal epilepsies:\n\n"
            "1. **Cortical Excitability:** Inadequate REM and slow-wave sleep increases interictal epileptiform spikes.\n"
            "2. **Recommended Duration:** Adults with epilepsy should aim for **7–9 hours of continuous sleep** nightly.\n"
            "3. **Circadian Consistency:** Keep consistent sleep and wake times, including on weekends, to stabilize circadian cortisol rhythms.\n"
            "4. **Sleep Log Telemetry:** Track your sleep quality and duration in the **Lifestyle & Logs** section to help your neurologist detect sleep-induced seizure patterns."
        )

    # 7. Triggers & Photosensitivity
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

    # 8. Pre-Ictal Auras & Warning Signs
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

    # Default Educational Synthesis
    return (
        "### 🧠 Educational Epilepsy Guidance\n\n"
        f"Regarding your inquiry: *\"{message}\"*\n\n"
        "Managing epilepsy successfully relies on a structured multimodal foundation:\n\n"
        "1. **Strict Medication Adherence:** Take all antiepileptic medications at the exact same hours every day.\n"
        "2. **Sleep Regularity:** Maintain 7–8+ hours of uninterrupted sleep to avoid lowering your seizure threshold.\n"
        "3. **Trigger Management:** Keep track of emotional stress, sensory exposure, and missed doses using your **Lifestyle & Logs** dashboard.\n"
        "4. **Emergency Readiness:** Ensure family, caretakers, and coworkers are familiar with seizure first-aid rules.\n\n"
        "*Disclaimer: EpiCare AI provides educational insights based on neurology guidelines. It is not a substitute for clinical diagnosis or individualized medical advice. Always consult your neurologist for treatment decisions.*"
    )


async def process_chat_message(db: AsyncSession, user_id: int, message: str) -> str:
    """
    Process a user's chatbot message.
    Checks if external RAG vector scripts exist in the RAG scripts directory;
    if not, seamlessly utilizes the integrated Clinical Educational Knowledge Engine.
    """
    query_script = RAG_SCRIPT_DIR / "query.py"
    is_rag_ready = query_script.exists()

    if is_rag_ready:
        logger.info("RAG query script found at %s. Invoking vector inference for user %s...", query_script, user_id)
        try:
            # Dynamically invoke the AI team's query module if present
            import importlib.util
            spec = importlib.util.spec_from_file_location("rag_query_module", str(query_script))
            if spec and spec.loader:
                rag_module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(rag_module)
                if hasattr(rag_module, "answer_question"):
                    return str(rag_module.answer_question(message, user_id))
        except Exception as exc:
            logger.error("Error during RAG script execution (%s). Falling back to internal engine.", exc)

    return generate_clinical_knowledge_response(message)
