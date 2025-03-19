$(document).ready(function() {
    console.log('Document ready');
    
    // Verify button exists
    const refreshBtn = $('#refreshLightsBtn');
    const dropZone = $('#dropZone');
    const fileInput = $('#fileInput');
    const browseBtn = $('#browseBtn');
    const uploadBtn = $('#uploadBtn');
    const fileInfo = $('#fileInfo');
    const fileName = $('#fileName');
    const removeFile = $('#removeFile');
    const uploadProgress = $('#uploadProgress');
    const progressBar = $('.progress-bar');
    const validateBtn = $('#validateBtn');
    const stopBtn = $('#stopBtn');
    
    let selectedFile = null;
    let currentRunId = null;
    let moduleUpdateInterval;

    // Handle drag and drop events
    dropZone.on('dragover', function(e) {
        e.preventDefault();
        $(this).addClass('active');
    });

    dropZone.on('dragleave', function(e) {
        e.preventDefault();
        $(this).removeClass('active');
    });

    dropZone.on('drop', function(e) {
        e.preventDefault();
        $(this).removeClass('active');
        
        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 1) {
            return;
        }
        
        handleFile(files[0]);
    });

    // Handle browse button click
    browseBtn.click(() => fileInput.click());

    // Handle file selection
    fileInput.change(function() {
        const file = this.files[0];
        handleFile(file);
    });

    // Handle file removal
    removeFile.click(function() {
        clearFile();
    });

    // Handle file upload
    uploadBtn.click(function() {
        if (!selectedFile) return;
        
        uploadFile(selectedFile);
    });

    // Handle validate button click
    validateBtn.click(function() {
        if (!selectedFile) return;
        
        // Here you can add validation logic
        // For now, just show a success message
    });

    // Handle stop button click
    stopBtn.click(function() {
        const serverUrl = getServerAddress();
        if (!serverUrl) {
            return;
        }

        if (!currentRunId) {
            return;
        }

        // Send stop request to the server
        $.ajax({
            url: `/protocols/stop`,
            method: 'POST',
            data: { target_url: serverUrl, run_id: currentRunId },
            success: (response) => {
                stopBtn.prop('disabled', true);
                currentRunId = null;
            },
            error: (xhr, status, error) => {
                const errorMsg = xhr.responseJSON?.message || error;
            }
        });
    });

    document.getElementById('movePipetteBtn').addEventListener('click', async function() {
        const serverUrl = getServerAddress();
        const responseArea = document.getElementById('responseArea');
        
        try {
            const formData = new FormData();
            formData.append('target_url', serverUrl);

            const response = await fetch('/move-pipette', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            responseArea.value = JSON.stringify(result, null, 2);
        } catch (error) {
            console.error('Error:', error);
        }
    });

    document.getElementById('disengageTempBtn').addEventListener('click', async function() {
        const serverUrl = getServerAddress();
        const responseArea = document.getElementById('responseArea');
        const button = $(this);
        
        try {
            // Show loading state
            button.prop('disabled', true);
            
            const formData = new FormData();
            formData.append('target_url', serverUrl);

            const response = await fetch('/modules/temperature/deactivate', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            responseArea.value = JSON.stringify(result, null, 2);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            // Reset button state
            button.prop('disabled', false);
        }
    });

    // Handle lighting toggle
    $('#lightingToggle').change(async function(event, skipRequest) {
        if (skipRequest) return; // Skip API call if we're just updating the UI
        
        const serverUrl = getServerAddress();
        if (!serverUrl) {
            $(this).prop('checked', !$(this).prop('checked')); // Revert toggle
            return;
        }

        const isOn = $(this).prop('checked');
        try {
            const formData = new FormData();
            formData.append('target_url', serverUrl);

            const response = await fetch(`/light/${isOn ? 'on' : 'off'}`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            $('#responseArea').val(JSON.stringify(result, null, 2));
        } catch (error) {
            console.error('Error:', error);
            $(this).prop('checked', !isOn); // Revert toggle on error
        }
    });

    // Handle UV toggle
    $('#uvToggle').change(async function(event, skipRequest) {
        if (skipRequest) return; // Skip API call if we're just updating the UI
        
        const serverUrl = getServerAddress();
        if (!serverUrl) {
            $(this).prop('checked', !$(this).prop('checked')); // Revert toggle
            return;
        }

        const isOn = $(this).prop('checked');
        try {
            const formData = new FormData();
            formData.append('target_url', serverUrl);

            const response = await fetch(`/uv/${isOn ? 'on' : 'off'}`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            $('#responseArea').val(JSON.stringify(result, null, 2));
        } catch (error) {
            console.error('Error:', error);
            $(this).prop('checked', !isOn); // Revert toggle on error
        }
    });

    // Handle UV toggle
    $('#fanToggle').change(async function(event, skipRequest) {
        if (skipRequest) return; // Skip API call if we're just updating the UI
        
        const serverUrl = getServerAddress();
        if (!serverUrl) {
            $(this).prop('checked', !$(this).prop('checked')); // Revert toggle
            return;
        }

        const isOn = $(this).prop('checked');
        try {
            const formData = new FormData();
            formData.append('target_url', serverUrl);

            const response = await fetch(`/fan/${isOn ? 'on' : 'off'}`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            $('#responseArea').val(JSON.stringify(result, null, 2));
        } catch (error) {
            console.error('Error:', error);
            $(this).prop('checked', !isOn); // Revert toggle on error
        }
    });

    // Handle refresh lights button
    refreshBtn.click(async function() {
        console.log('Refresh button clicked');
        const button = $(this);
        const serverUrl = getServerAddress();
        
        if (!serverUrl) {
            return;
        }

        try {
            // Show loading state
            button.prop('disabled', true);
            button.find('i').addClass('fa-spin');

            const formData = new FormData();
            formData.append('target_url', serverUrl);

            const response = await fetch('/lights/status', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            // Update toggle states without triggering their change events
            $('#lightingToggle').prop('checked', result.data.lighting).trigger('change', [true]);
            $('#uvToggle').prop('checked', result.data.ultraviolet).trigger('change', [true]);
            $('#fanToggle').prop('checked', result.data.ffu).trigger('change', [true]);
            $('#responseArea').val(JSON.stringify(result, null, 2));
        } catch (error) {
            console.error('Error:', error);
        } finally {
            // Reset loading state
            button.prop('disabled', false);
            button.find('i').removeClass('fa-spin');
        }
    });

    // Handle magnetic module disengagement
    document.getElementById('disengageMagnetBtn').addEventListener('click', async function() {
        const serverUrl = getServerAddress();
        const responseArea = document.getElementById('responseArea');
        const button = $(this);
        
        try {
            button.prop('disabled', true);
            
            const formData = new FormData();
            formData.append('target_url', serverUrl);

            const response = await fetch('/modules/magnetic/disengage', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            responseArea.value = JSON.stringify(result, null, 2);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            button.prop('disabled', false);
        }
    });

    // Handle heater deactivation
    document.getElementById('deactivateHeaterShakerBtn').addEventListener('click', async function() {
        const serverUrl = getServerAddress();
        const responseArea = document.getElementById('responseArea');
        const button = $(this);
        
        try {
            button.prop('disabled', true);
            
            const formData = new FormData();
            formData.append('target_url', serverUrl);

            const response = await fetch('/modules/heater-shaker/deactivate', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            responseArea.value = JSON.stringify(result, null, 2);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            button.prop('disabled', false);
        }
    });

    // Handle thermocycler deactivation
    document.getElementById('deactivateThermocyclerBtn').addEventListener('click', async function() {
        const serverUrl = getServerAddress();
        const responseArea = document.getElementById('responseArea');
        const button = $(this);
        
        try {
            button.prop('disabled', true);
            
            const formData = new FormData();
            formData.append('target_url', serverUrl);

            const response = await fetch('/modules/thermocycler/deactivate', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            responseArea.value = JSON.stringify(result, null, 2);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            button.prop('disabled', false);
        }
    });

    function handleFile(file) {
        if (!file) return;
        
        // Validate file type
        if (!file.name.toLowerCase().endsWith('.py') && !file.name.toLowerCase().endsWith('.json')) {
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return;
        }

        // Check if multiple files were dropped
        if (fileInput[0].files.length > 1) {
            clearFile();
            return;
        }

        selectedFile = file;
        fileName.text(file.name);
        fileInfo.show();
        uploadBtn.prop('disabled', false);
        stopBtn.prop('disabled', true);
    }

    function clearFile() {
        selectedFile = null;
        fileInput.val('');
        fileInfo.hide();
        uploadBtn.prop('disabled', true);
        uploadProgress.hide();
        progressBar.css('width', '0%');
    }

    function getServerAddress() {
        const url = $('#serverUrl').val().trim();
        const port = $('#serverPort').val().trim();
        return `${url}:${port}`;
    }

    function uploadFile(file) {
        const serverUrl = getServerAddress();
        if (!serverUrl) {
            return;
        }

        const formData = new FormData();
        formData.append('files', file);
        formData.append('target_url', serverUrl);

        uploadBtn.prop('disabled', true);
        uploadProgress.show();
        $('#responseArea').val('');

        $.ajax({
            url: '/protocols',
            method: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            xhr: () => {
                const xhr = new XMLHttpRequest();
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        progressBar.css('width', Math.round((e.loaded / e.total) * 100) + '%');
                    }
                };
                return xhr;
            },
            success: (response) => {
                $('#responseArea').val(JSON.stringify(response, null, 2));
                uploadBtn.prop('disabled', true);
                stopBtn.prop('disabled', false);
                currentRunId = response.run_id;
                clearFile();
            },
            error: (xhr, status, error) => {
                const errorMsg = xhr.responseJSON?.message || error;
                $('#responseArea').val(xhr.responseJSON ? JSON.stringify(xhr.responseJSON, null, 2) : '');
                uploadBtn.prop('disabled', false);
                uploadProgress.hide();
            }
        });
    }

    function startModuleUpdates() {
        // Clear any existing interval
        if (moduleUpdateInterval) {
            clearInterval(moduleUpdateInterval);
        }

        // Initial update
        updateModuleStatus();

        // Set up interval for updates every 5 seconds
        moduleUpdateInterval = setInterval(updateModuleStatus, 5000);
    }

    function formatTemperature(temp) {
        // return temp ? `${temp.toFixed(1)}°C` : 'N/A';
        return `${temp.toFixed(1)}°C`
    }

    async function updateModuleStatus() {
        const serverUrl = getServerAddress();
        if (!serverUrl) return;

        try {
            const formData = new FormData();
            formData.append('target_url', serverUrl);

            const response = await fetch('/modules', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.success) {
                updateModulesUI(result.data);
                $('#moduleLastUpdate').text('Last updated: ' + new Date().toLocaleTimeString());
            }
        } catch (error) {
            console.error('Error fetching module status:', error);
        }
    }

    function updateModulesUI(modules) {
        const container = $('#modulesContainer');
        container.empty();

        modules.forEach(module => {
            const moduleHtml = createModuleCard(module);
            container.append(moduleHtml);
        });
    }

    function createModuleCard(module) {
        const moduleIcons = {
            magneticModuleType: 'magnet',
            heaterShakerModuleType: 'temperature-high',
            temperatureModuleType: 'thermometer-half',
            thermocyclerModuleType: 'dna'
        };

        const icon = moduleIcons[module.moduleType] || 'cube';
        const data = module.data;

        let statusDetails = '';
        
        switch (module.moduleType) {
            case 'magneticModuleType':
                statusDetails = `
                    <p class="mb-1"><strong>Status:</strong> ${data.status}</p>
                    <p class="mb-1"><strong>Engaged:</strong> ${data.engaged}</p>
                    <p class="mb-0"><strong>Height:</strong> ${data.height}</p>
                `;
                break;

            case 'heaterShakerModuleType':
                statusDetails = `
                    <p class="mb-1"><strong>Status:</strong> ${data.status}</p>
                    <p class="mb-1"><strong>Latch:</strong> ${data.labwareLatchStatus}</p>
                    <p class="mb-1"><strong>Speed:</strong> ${data.currentSpeed} rpm (Target: ${data.targetSpeed} rpm)</p>
                    <p class="mb-0"><strong>Temperature:</strong> ${formatTemperature(data.currentTemperature)} (Target: ${formatTemperature(data.targetTemperature)})</p>
                `;
                break;

            case 'temperatureModuleType':
                statusDetails = `
                    <p class="mb-1"><strong>Status:</strong> ${data.status}</p>
                    <p class="mb-0"><strong>Temperature:</strong> ${formatTemperature(data.currentTemperature)} (Target: ${formatTemperature(data.targetTemperature)})</p>
                `;
                break;

            case 'thermocyclerModuleType':
                statusDetails = `
                    <p class="mb-1"><strong>Status:</strong> ${data.status}</p>
                    <p class="mb-1"><strong>Temperature:</strong> ${formatTemperature(data.currentTemperature)} (Target: ${formatTemperature(data.targetTemperature)})</p>
                    <p class="mb-1"><strong>Lid:</strong> ${data.lidStatus} (${formatTemperature(data.lidTemperature)})</p>
                    <p class="mb-0"><strong>Progress:</strong> Cycle ${data.currentCycleIndex}/${data.totalCycleCount}, Step ${data.currentStepIndex}/${data.totalStepCount}</p>
                `;
                break;
        }

        return `
            <div class="col-md-6 col-lg-3">
                <div class="module-card card h-100">
                    <div class="card-header">
                        <h5 class="mb-0">
                            <i class="fas fa-${icon} me-2"></i>
                            ${module.moduleModel}
                        </h5>
                    </div>
                    <div class="card-body">
                        ${statusDetails}
                    </div>
                </div>
            </div>
        `;
    }

    startModuleUpdates();
}); 