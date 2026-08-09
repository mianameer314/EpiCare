# EpiCare Database Schema Explained

Here is an easy-to-understand breakdown of all the tables in the EpiCare database. Instead of just listing them, I have grouped them logically so you can see exactly how the entire project fits together!

---

## 1. Users & Identities (The People)
These tables handle who is logging in and what their specific role is.

* **`User`**: The master table. Every single person who signs up (patient, doctor, or caretaker) gets a row here. It stores universal things: `email`, `password`, `full_name`.
* **`PatientProfile`**: If the user is a patient, this stores their specific data. 
    * *Example:* Their `date_of_birth`, `blood_group`, and `medical_history`.
* **`DoctorProfile`**: If the user is a doctor, this stores their professional credentials.
    * *Example:* Their `pmdc_number`, `specialty` (e.g., Neurologist), and `hospital_affiliation`.
* **`CaretakerProfile`**: If the user is a caretaker (like a parent or spouse), this stores their specific details.

---

## 2. Connections (The Network)
These tables connect the people above together securely.

* **`PatientDoctorNetwork`**: Links a patient to their chosen doctor. 
    * *Example:* "Patient Ali gives permission to Doctor Ahmed to view his EEG reports."
* **`PatientCaretakerNetwork`**: Links a patient to their family member or nurse.
    * *Example:* "Patient Ali links his mother as his caretaker so she receives SOS alerts."

---

## 3. EEG & AI Core (The Machine Learning)
This is the heart of your Final Year Project (FYP)—handling the brainwaves and the AI.

* **`EegSession`**: Represents a single EEG file uploaded by a patient.
    * *Example:* Ali uploads an `.edf` file from his smartwatch recorded on Tuesday.
* **`Prediction`**: The raw mathematical output from the AI model analyzing that EEG file.
    * *Example:* The AI spits out "Probability of seizure: 89% at minute 14."
* **`AiReport`**: The human-readable PDF or summary generated from the raw prediction.
    * *Example:* "Patient Ali is at high risk of a seizure based on abnormal frontal lobe waves."
* **`ModelVersion`**: Keeps track of exactly which version of the AI model made the prediction.
    * *Example:* "Prediction made using EpiCareFusion v1.2."

---

## 4. Medication Management (The Pharmacy)
These tables handle what drugs the patient is taking and whether they actually took them.

* **`Medication`**: The actual drug prescribed to the patient.
    * *Example:* "Keppra 500mg, prescribed by Doctor Ahmed."
* **`MedicationSchedule`**: The rules for when to take the drug.
    * *Example:* "Take 1 pill every day at 8:00 AM."
* **`MedicationLog`**: The patient checking the box saying they took it.
    * *Example:* "Ali marked Keppra as 'Taken' on Monday at 8:05 AM." (If this is missing, the background scheduler sends a reminder!)

---

## 5. Daily Lifestyle Tracking (The Diary)
Epilepsy is highly affected by daily habits. These tables track those habits.

* **`LifestyleLog`**: A daily diary entry.
    * *Example:* "Felt dizzy today after lunch."
* **`SleepLog`**: Tracking sleep, because lack of sleep triggers seizures.
    * *Example:* "Slept for 5 hours, woke up 3 times."
* **`TriggerLog`**: Recording known seizure triggers.
    * *Example:* "Looked at flashing strobe lights at a concert."

---

## 6. SOS & Emergencies (The Lifesavers)
These tables handle the Twilio SMS system when a seizure is predicted or actively happening.

* **`EmergencyContact`**: The phone numbers to call/text in an emergency.
    * *Example:* Ali's brother's phone number.
* **`SosEvent`**: The actual emergency incident being triggered.
    * *Example:* "Seizure detected at 3:00 PM; SOS triggered."
* **`SosDelivery`**: Proof that the SMS was actually delivered by Twilio.
    * *Example:* "SMS successfully delivered to Ali's brother at 3:01 PM."

---

## 7. AI Chatbot Assistant (The Smart Assistant)
If you build a chatbot (RAG system) so patients can ask medical questions, these tables power it.

* **`ChatSession`**: The conversation thread.
    * *Example:* "Chat about side effects of Keppra."
* **`ChatMessage`**: Individual messages back and forth.
    * *Example:* User asks "Does Keppra make you tired?", AI replies "Yes, fatigue is a common side effect."
* **`RagDocument` & `RagChunk`**: Textbooks, medical journals, or past patient data broken down into tiny pieces so the AI can read them quickly to answer questions.

---

## 8. System Admin (Behind the Scenes)
* **`AuditLog`**: A security camera for your database. It records every time someone does something important.
    * *Example:* "Admin John deleted Patient Ali's profile at 4:00 PM."
* **`Recommendation`**: Automated tips generated for the patient based on their lifestyle data.
    * *Example:* "You only slept 4 hours last night; your seizure risk is elevated today."
