// ===== CI/CD Dashboard Script =====

// DOM Elements
const runBtn = document.getElementById('runBtn');
const clearBtn = document.getElementById('clearBtn');
const output = document.getElementById('output');
const outputSection = document.getElementById('outputSection');
const platformSelect = document.getElementById('platformSelect');
const tokenInput = document.getElementById('tokenInput');
const toggleTokenBtn = document.getElementById('toggleTokenBtn');
const filenameInput = document.getElementById('filenameInput');
const filenameGroup = document.getElementById('filenameGroup');
const testerNameInput = document.getElementById('testerNameInput');
const greetingInput = document.getElementById('greetingInput');

// Platform URL inputs
const webchatUrlInput = document.getElementById('webchatUrlInput');
const telegramBotInput = document.getElementById('telegramBotInput');
const instagramUrlInput = document.getElementById('instagramUrlInput');
const facebookUrlInput = document.getElementById('facebookUrlInput');
const dhaiUrlInput = document.getElementById('dhaiUrlInput');
const dhaiWakeWordInput = document.getElementById('dhaiWakeWordInput'); // New element

// File upload elements
const fileUpload = document.getElementById('fileUpload');
const fileUploadText = document.getElementById('fileUploadText');
const fileUploadLabel = document.querySelector('.file-upload-label');
const clearFileBtn = document.getElementById('clearFileBtn');

// Configuration
const CONFIG = {
    owner: 'katanyaaman',
    repo: 'migrasiplaywright12345',
    workflow_id: 'test-reports.yml',
    ref: 'main'
};

// Platform URL mapping
const platformUrlGroups = {
    webchat: 'webchatUrlGroup',
    telegram: 'telegramUrlGroup',
    instagram: 'instagramUrlGroup',
    facebook: 'facebookUrlGroup',
    dhai: 'dhaiUrlGroup',
    all: 'webchatUrlGroup' // Default to webchat for 'all'
};

// File upload state
let uploadedFile = null;

// ===== Token Visibility Toggle =====
function toggleTokenVisibility() {
    const isPassword = tokenInput.type === 'password';
    tokenInput.type = isPassword ? 'text' : 'password';
    toggleTokenBtn.innerHTML = isPassword ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
    toggleTokenBtn.classList.toggle('active', isPassword);
}

// ===== Platform URL Switching =====
function switchPlatformUrl(platform) {
    // Hide all platform URL groups
    document.querySelectorAll('.platform-url').forEach(group => {
        group.classList.remove('active');
        group.style.display = 'none';
    });

    // Show selected platform URL group
    const groupId = platformUrlGroups[platform];
    if (groupId) {
        const group = document.getElementById(groupId);
        if (group) {
            group.classList.add('active');
            group.style.display = 'flex';
        }
    }
}

// ===== File Upload Handling =====
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        uploadedFile = file;
        const fileName = file.name;
        const fileSize = (file.size / 1024).toFixed(2); // KB

        fileUploadText.textContent = `${fileName} (${fileSize} KB)`;
        fileUploadLabel.classList.add('has-file');
        clearFileBtn.style.display = 'block';

        // Hide filename input when file is uploaded
        filenameGroup.style.display = 'none';

        showOutput(`File selected: ${fileName}`, 'info');
    }
}

function clearUploadedFile() {
    uploadedFile = null;
    fileUpload.value = '';
    fileUploadText.textContent = 'Choose Excel or CSV file';
    fileUploadLabel.classList.remove('has-file');
    clearFileBtn.style.display = 'none';

    // Show filename input again
    filenameGroup.style.display = 'flex';

    showOutput('File upload cleared', 'info');
}

// ===== Utility Functions =====
function showOutput(message, type = 'info') {
    outputSection.style.display = 'block';
    const timestamp = new Date().toLocaleTimeString();
    const icon = {
        info: 'ℹ️',
        success: '✅',
        error: '❌',
        warning: '⚠️'
    }[type] || 'ℹ️';

    output.textContent += `[${timestamp}] ${icon} ${message}\n`;
    output.scrollTop = output.scrollHeight;
}

function clearOutput() {
    output.textContent = '';
    outputSection.style.display = 'none';
}

function setLoading(isLoading) {
    if (isLoading) {
        runBtn.classList.add('loading');
        runBtn.disabled = true;
        runBtn.innerHTML = '<i class="fas fa-spinner"></i><span>Running...</span>';
    } else {
        runBtn.classList.remove('loading');
        runBtn.disabled = false;
        runBtn.innerHTML = '<i class="fas fa-play-circle"></i><span>Run Tests</span>';
    }
}

function getCurrentPlatformUrl() {
    const platform = platformSelect.value;

    switch (platform) {
        case 'webchat':
            return webchatUrlInput.value || 'https://chat.botika.online/tpUyiey';
        case 'telegram':
            return telegramBotInput.value || '';
        case 'instagram':
            return instagramUrlInput.value || '';
        case 'facebook':
            return facebookUrlInput.value || '';
        case 'dhai':
            return dhaiUrlInput.value || '';
        case 'all':
            return webchatUrlInput.value || 'https://chat.botika.online/tpUyiey';
        default:
            return '';
    }
}

function getFormData() {
    return {
        // Matches YAML Env Variables
        SELECTED_PLATFORM: platformSelect.value,
        // Keep full filename with extension for proper format detection
        FILENAME: uploadedFile ? uploadedFile.name : (filenameInput.value ? filenameInput.value + '.xlsx' : 'testing.xlsx'),
        TESTER_NAME: testerNameInput.value || 'GitHub Actions Bot',
        GREETING: greetingInput.value || 'Haloo',

        // Specific inputs mapping
        WEBCHAT_URL: webchatUrlInput.value || 'https://chat.botika.online/tpUyiey',
        DHAI_TARGET_URL: dhaiUrlInput.value || 'https://client.botika.online/virtual-avatar-luna/?mode=wake-word',
        DHAI_WAKE_WORD: dhaiWakeWordInput ? dhaiWakeWordInput.value : 'halo luna',
        INSTAGRAM_USERNAME: instagramUrlInput.value || '',
        FACEBOOK_FANPAGE_ID: facebookUrlInput.value || '',
        TELEGRAM_BOT_USERNAME: telegramBotInput.value || ''
    };
}

// ===== File Upload to GitHub =====
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // Remove data URL prefix (e.g., "data:application/vnd.ms-excel;base64,")
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function uploadFileToGitHub(file, token) {
    const path = `assets/xlsx/${file.name}`;
    const message = `📤 Upload test file: ${file.name} via CI/CD Dashboard`;

    showOutput(`📤 Uploading ${file.name} to repository...`, 'info');

    // Read file as base64
    const base64Content = await readFileAsBase64(file);

    // Check if file exists (to get SHA for update)
    const checkUrl = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}`;
    let sha = null;

    try {
        const checkResponse = await fetch(checkUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (checkResponse.ok) {
            const data = await checkResponse.json();
            sha = data.sha;
            showOutput(`📝 File exists, will update...`, 'info');
        } else {
            showOutput(`📝 Creating new file...`, 'info');
        }
    } catch (e) {
        showOutput(`📝 Creating new file...`, 'info');
    }

    // Upload file
    const uploadUrl = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}`;
    const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: message,
            content: base64Content,
            sha: sha, // Include SHA if updating existing file
            branch: CONFIG.ref
        })
    });

    if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Upload failed (${uploadResponse.status}): ${errorText}`);
    }

    const result = await uploadResponse.json();
    showOutput(`✅ File uploaded successfully!`, 'success');
    showOutput(`📍 Commit: ${result.commit.sha.substring(0, 7)}`, 'info');

    return result;
}

function resetForm() {
    platformSelect.value = 'webchat';
    switchPlatformUrl('webchat');

    tokenInput.value = '';
    tokenInput.type = 'password';
    toggleTokenBtn.innerHTML = '<i class="fas fa-eye"></i>';
    toggleTokenBtn.classList.remove('active');

    filenameInput.value = 'testing';
    testerNameInput.value = 'GitHub Actions Bot';
    greetingInput.value = 'Haloo';
    webchatUrlInput.value = 'https://chat.botika.online/tpUyiey';
    telegramBotInput.value = '';
    instagramUrlInput.value = '';
    facebookUrlInput.value = '';
    dhaiUrlInput.value = '';

    clearUploadedFile();
    clearOutput();
}

// ===== Main Function =====
async function triggerWorkflow() {
    // Get GitHub Token from input field
    const token = tokenInput.value.trim();

    if (!token) {
        showOutput('GitHub token is required!', 'error');
        showOutput('Please enter your Personal Access Token above', 'warning');
        tokenInput.focus();
        return;
    }

    setLoading(true);
    clearOutput();

    // Step 1: Upload file to GitHub if user selected one
    if (uploadedFile) {
        try {
            showOutput('🚀 Step 1/2: Uploading test file to GitHub...', 'info');
            await uploadFileToGitHub(uploadedFile, token);

            // Wait for GitHub to process the file
            showOutput('⏳ Waiting for GitHub to process file...', 'info');
            await new Promise(resolve => setTimeout(resolve, 2000));

            showOutput('✅ File ready for testing!', 'success');
        } catch (error) {
            showOutput(`❌ File upload failed: ${error.message}`, 'error');
            showOutput('Please check your token permissions and try again', 'warning');
            setLoading(false);
            return;
        }
    }

    // Step 2: Trigger workflow
    const formData = getFormData();

    showOutput('🚀 Step 2/2: Triggering GitHub Actions workflow...', 'info');
    showOutput(`Platform: ${formData.SELECTED_PLATFORM}`, 'info');

    if (uploadedFile) {
        showOutput(`Uploaded File: ${uploadedFile.name}`, 'info');
        showOutput('⚠️ Note: File upload to GitHub Actions requires additional setup', 'warning');
        showOutput('The uploaded file will be used locally, but workflow will use repository file', 'warning');
    } else {
        showOutput(`Test File: ${formData.FILENAME}`, 'info');
    }

    showOutput(`Tester: ${formData.TESTER_NAME}`, 'info');
    showOutput(`Platform URL: ${formData.WEBCHAT_URL || 'Default'}`, 'info');

    try {
        const url = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/actions/workflows/${CONFIG.workflow_id}/dispatches`;

        showOutput('Sending request to GitHub Actions...', 'info');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ref: CONFIG.ref,
                inputs: formData
            })
        });

        if (response.ok) {
            showOutput('Workflow dispatched successfully!', 'success');
            showOutput('Check GitHub Actions for the run status', 'info');
            showOutput(`View at: https://github.com/${CONFIG.owner}/${CONFIG.repo}/actions`, 'info');

            // Show success animation
            setTimeout(() => {
                showOutput('You can close this window or trigger another test', 'info');
            }, 1000);
        } else {
            const errorText = await response.text();
            let errorMessage = `Failed with status ${response.status}`;

            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.message || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }

            showOutput(`Failed to dispatch workflow: ${errorMessage}`, 'error');

            if (response.status === 401) {
                showOutput('Token is invalid or expired. Please check your token.', 'warning');
                showOutput('Get a new token at: https://github.com/settings/tokens', 'info');
            } else if (response.status === 404) {
                showOutput('Workflow not found. Please check repository and workflow name.', 'warning');
            }
        }
    } catch (error) {
        showOutput(`Network error: ${error.message}`, 'error');
        showOutput('Please check your internet connection and try again.', 'warning');
    } finally {
        setLoading(false);
    }
}

// ===== Event Listeners =====
runBtn.addEventListener('click', triggerWorkflow);
clearBtn.addEventListener('click', resetForm);
toggleTokenBtn.addEventListener('click', toggleTokenVisibility);
platformSelect.addEventListener('change', (e) => switchPlatformUrl(e.target.value));
fileUpload.addEventListener('change', handleFileUpload);
clearFileBtn.addEventListener('click', clearUploadedFile);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to run
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        triggerWorkflow();
    }

    // Ctrl/Cmd + R to reset
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        resetForm();
    }
});

// ===== Initialization =====
switchPlatformUrl('webchat'); // Show webchat URL by default

// Initial message
console.log('%c🚀 CI/CD Dashboard Ready!', 'color: #667eea; font-size: 16px; font-weight: bold;');
console.log('%cKeyboard Shortcuts:', 'color: #667eea; font-weight: bold;');
console.log('  Ctrl/Cmd + Enter: Run Tests');
console.log('  Ctrl/Cmd + R: Reset Form');
console.log('%cFeatures:', 'color: #667eea; font-weight: bold;');
console.log('  ✓ Dynamic platform-specific URLs');
console.log('  ✓ File upload support (Excel/CSV)');
console.log('  ✓ Real-time output logging');
