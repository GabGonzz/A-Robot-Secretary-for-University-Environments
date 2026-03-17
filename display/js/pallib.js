/** PALLib version intended for off-line use */
class PalLib {
	/**
		* Create a PALLib object. It is recomended to use a single
		* object throught the page.
		*/
	constructor() {
		console.log("Using offline PALLib SDK");
		this.initialized = false;
		this.motion_timeout_id = -1;
		this.speech_timeout_id = -1;
	}

	/**
		* PALLib oject should be initialized on page load
		*/
	init() {
		console.log("Init PALLib SDK");
		this.initialized = true;
	}

	/**
		*  Execute a named motion and execute a callback after it is finished
		* @param {string} motion - Name of the motion to be executed
		* @param {number} tracking_interval - Time at which to check the status of the motion, in ms. (500 recommended)
		* @param {function} end_cb - Function to call at the end of the motion, receives status of the motion
		* @param {function} goal_cb - Function to call when the motion is accepted by the robot, receives internal ID. Optional.
		*/
	executeAndTrackMotion(motion, tracking_interval, end_cb, goal_cb) {
		if (!this.initialized) {
			console.log("Called without initializing, failing");
			return;
		} else if (this.motion_timeout_id != -1) {
			console.log("Aborting current motion");
			window.clearTimeout(this.motion_timeout_id);
			this.motion_timeout_id = -1;
		}

		window.setTimeout(() => {
			if (goal_cb !== undefined)
				goal_cb("goal_id");
			
			console.log("Goal accepted by the robot. Starting motion " + motion);
		}, 100);

		let timeout = tracking_interval * (Math.floor(Math.random() * 10) + 1); // Randomize time to end
		this.motion_timeout_id = window.setTimeout(() => {
			end_cb("SUCCEEDED");
			this.motion_timeout_id = -1;
			console.log("Motion " + motion + " ended.");
		}, timeout);
	}

	/**
		*  Say a sentence in a language, and execute a callback when it is finished
		* @param {string} text - Sentence to be said by the robot
		* @param {string} lang - Language code to be used
		* @param {number} tracking_interval - Time at which to check the status of the speech, in ms. (500 recommended)
		* @param {function} end_cb - Function to call at the end of the speech, receives status of the speech
		* @param {function} goal_cb - Function to call when the speech is accepted by the robot, receives internal ID. Optional.
		*/
	sayAndTrack(text, lang, tracking_interval, end_cb, goal_cb) {
		if (!this.initialized) {
			console.log("Called without initializing, failing");
			return;
		} else if (this.speech_timeout_id != -1) {
			console.log("Aborting current speech");
			window.clearTimeout(this.speech_timeout_id);
			this.speech_timeout_id = -1;
		}

		window.setTimeout(() => {
			if (goal_cb !== undefined)
				goal_cb("goal_id");
			this.speech_timeout_id = true;
			console.log("Goal accepted by the robot. Starting speech: " + text);

			if (lang == "es_ES")
				console.log("In spanish");
			else if (lang == "ca_ES")
				console.log("In catalan");
			else if (lang == "en_GB")
				console.log("In english");
			else
				console.log("In unknown language, defaulting to english");
		}, 100);

		let timeout = tracking_interval * (Math.floor(Math.random() * 10) + 1); // Randomize time to end
		this.speech_timeout_id = window.setTimeout(() => {
			end_cb("SUCCEEDED");
			this.speech_timeout_id = -1;
			console.log("Speech ended.");
		}, timeout);
	}	
   	/**
	 * 
	 * @param {string} page - folder name of the page to navigate inside the project
	 */
	switchPage(page) {
		console.log(`Changing screen to ${page}`);
		window.location = `${window.location.origin}/${page}`;
	}
	/**
	 * 
	 * @param {string} project - Folder (uri) of the project to display
	 * @example
	 * switchProject("project_folder")
	 * Calling this function with just the project folder, will switch to that project and go the entrypoint
	 * 
	 * if a specific project page needs to be displayed then pass the page folder (uri) separated by slash
	 * 
	 * @example
	 * switchProject("project_folder/page_folder")
	 * Goes to the project and displays the page
	 * 
	 * @example
	 * switchProject("project_folder/page_folder?param=value")
	 * Switch to the page and pass query params
	 */
	switchProject(project) {
		console.log(`Switching to project with folder: ${project}`);
	}
}