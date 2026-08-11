CREATE TABLE model_versions (
	id SERIAL NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	version VARCHAR(20) NOT NULL, 
	framework VARCHAR(50) NOT NULL, 
	path VARCHAR(500) NOT NULL, 
	input_schema JSONB, 
	threshold FLOAT NOT NULL, 
	accuracy FLOAT, 
	sensitivity FLOAT, 
	specificity FLOAT, 
	f1 FLOAT, 
	auroc FLOAT, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE rag_documents (
	id SERIAL NOT NULL, 
	title VARCHAR(300) NOT NULL, 
	source_path VARCHAR(500) NOT NULL, 
	checksum VARCHAR(64) NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE users (
	id SERIAL NOT NULL, 
	email VARCHAR(255) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	phone_number VARCHAR(30), 
	fcm_token VARCHAR(255), 
	full_name VARCHAR(150) NOT NULL, 
	role user_role_enum NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	is_email_verified BOOLEAN NOT NULL, 
	is_phone_verified BOOLEAN NOT NULL, 
	otp_secret_hash VARCHAR(255), 
	otp_expires_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE audit_logs (
	id SERIAL NOT NULL, 
	user_id INTEGER, 
	action VARCHAR(100) NOT NULL, 
	entity_type VARCHAR(50) NOT NULL, 
	entity_id INTEGER, 
	metadata JSONB, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE caretaker_profiles (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	relationship_to_patient VARCHAR(100), 
	crisis_phone_number VARCHAR(30), 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE chat_sessions (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE doctor_profiles (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	pmdc_number VARCHAR(50) NOT NULL, 
	specialty VARCHAR(100) NOT NULL, 
	hospital_affiliation VARCHAR(200), 
	license_image_url VARCHAR(500), 
	is_pmdc_verified BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE eeg_sessions (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	original_filename VARCHAR(255) NOT NULL, 
	stored_path VARCHAR(500) NOT NULL, 
	file_size_bytes BIGINT NOT NULL, 
	file_hash VARCHAR(64) NOT NULL, 
	status VARCHAR(30) DEFAULT 'UPLOADED' NOT NULL, 
	validation_result JSONB, 
	error_message TEXT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE emergency_contacts (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	name VARCHAR(150) NOT NULL, 
	relationship VARCHAR(100) NOT NULL, 
	phone_number VARCHAR(30) NOT NULL, 
	is_primary BOOLEAN NOT NULL, 
	verified BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE lifestyle_logs (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	log_type VARCHAR(20) NOT NULL, 
	occurred_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	metadata_dict JSONB, 
	notes TEXT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE manual_seizure_logs (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	occurred_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	duration_seconds INTEGER NOT NULL, 
	seizure_type VARCHAR(100), 
	auras_felt TEXT, 
	post_ictal_symptoms TEXT, 
	notes TEXT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE medications (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	name VARCHAR(150) NOT NULL, 
	dosage VARCHAR(100) NOT NULL, 
	frequency VARCHAR(50) NOT NULL, 
	start_date DATE NOT NULL, 
	notes TEXT, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE patient_profiles (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	date_of_birth DATE NOT NULL, 
	gender VARCHAR(30), 
	blood_type VARCHAR(10), 
	city VARCHAR(100), 
	primary_diagnosis VARCHAR(100), 
	emergency_contact_name VARCHAR(150), 
	emergency_contact_relation VARCHAR(100), 
	emergency_contact_phone VARCHAR(30), 
	known_triggers JSONB, 
	notes TEXT, 
	timezone VARCHAR(64) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE rag_chunks (
	id SERIAL NOT NULL, 
	document_id INTEGER NOT NULL, 
	chunk_index INTEGER NOT NULL, 
	content VARCHAR NOT NULL, 
	embedding VECTOR(1536), 
	metadata JSONB, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(document_id) REFERENCES rag_documents (id) ON DELETE CASCADE
);

CREATE TABLE recommendations (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	category VARCHAR(50) NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	body TEXT NOT NULL, 
	rationale TEXT, 
	evidence_tags JSONB, 
	is_dismissed BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE sleep_logs (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	slept_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	woke_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	duration_minutes INTEGER NOT NULL, 
	quality INTEGER, 
	notes TEXT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE sos_events (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	triggered_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	latitude FLOAT, 
	longitude FLOAT, 
	location_available BOOLEAN NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	payload JSONB, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE trigger_logs (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	trigger_name VARCHAR(100) NOT NULL, 
	severity INTEGER NOT NULL, 
	occurred_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	notes TEXT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE chat_messages (
	id SERIAL NOT NULL, 
	session_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	role VARCHAR(20) NOT NULL, 
	content TEXT NOT NULL, 
	sources JSONB, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(session_id) REFERENCES chat_sessions (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE medication_schedules (
	id SERIAL NOT NULL, 
	medication_id INTEGER NOT NULL, 
	scheduled_time TIME WITHOUT TIME ZONE NOT NULL, 
	days_of_week JSONB, 
	reminder_enabled BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(medication_id) REFERENCES medications (id) ON DELETE CASCADE
);

CREATE TABLE patient_caretaker_networks (
	id SERIAL NOT NULL, 
	patient_id INTEGER NOT NULL, 
	caretaker_id INTEGER NOT NULL, 
	relationship_status connection_status_enum NOT NULL, 
	can_proxy BOOLEAN DEFAULT 'false' NOT NULL, 
	date_linked TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uix_patient_caretaker_network UNIQUE (patient_id, caretaker_id), 
	FOREIGN KEY(patient_id) REFERENCES patient_profiles (id) ON DELETE CASCADE, 
	FOREIGN KEY(caretaker_id) REFERENCES caretaker_profiles (id) ON DELETE CASCADE
);

CREATE TABLE patient_doctor_networks (
	id SERIAL NOT NULL, 
	patient_id INTEGER NOT NULL, 
	doctor_id INTEGER NOT NULL, 
	relationship_status connection_status_enum NOT NULL, 
	date_linked TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uix_patient_doctor_network UNIQUE (patient_id, doctor_id), 
	FOREIGN KEY(patient_id) REFERENCES patient_profiles (id) ON DELETE CASCADE, 
	FOREIGN KEY(doctor_id) REFERENCES doctor_profiles (id) ON DELETE CASCADE
);

CREATE TABLE predictions (
	id SERIAL NOT NULL, 
	session_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	model_version_id INTEGER, 
	predicted_class VARCHAR(20) NOT NULL, 
	confidence FLOAT NOT NULL, 
	threshold FLOAT NOT NULL, 
	positive_windows INTEGER NOT NULL, 
	total_windows INTEGER NOT NULL, 
	max_probability FLOAT NOT NULL, 
	mean_probability FLOAT NOT NULL, 
	window_probabilities JSONB, 
	status VARCHAR(30) DEFAULT 'COMPLETED' NOT NULL, 
	error_message TEXT, 
	started_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	completed_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(session_id) REFERENCES eeg_sessions (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(model_version_id) REFERENCES model_versions (id) ON DELETE SET NULL
);

CREATE TABLE sos_deliveries (
	id SERIAL NOT NULL, 
	sos_event_id INTEGER NOT NULL, 
	contact_id INTEGER NOT NULL, 
	delivery_status VARCHAR(30) NOT NULL, 
	provider_message_id VARCHAR(100), 
	error_message TEXT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(sos_event_id) REFERENCES sos_events (id) ON DELETE CASCADE, 
	FOREIGN KEY(contact_id) REFERENCES emergency_contacts (id) ON DELETE CASCADE
);

CREATE TABLE ai_reports (
	id SERIAL NOT NULL, 
	prediction_id INTEGER NOT NULL, 
	report_json JSONB NOT NULL, 
	model_version VARCHAR(50) NOT NULL, 
	status VARCHAR(30) DEFAULT 'COMPLETED' NOT NULL, 
	error_message TEXT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(prediction_id) REFERENCES predictions (id) ON DELETE CASCADE
);

CREATE TABLE medication_logs (
	id SERIAL NOT NULL, 
	schedule_id INTEGER, 
	medication_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	taken_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	dose_taken VARCHAR(100), 
	PRIMARY KEY (id), 
	FOREIGN KEY(schedule_id) REFERENCES medication_schedules (id) ON DELETE SET NULL, 
	FOREIGN KEY(medication_id) REFERENCES medications (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

