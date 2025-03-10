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
            showAlert('Please drop only one Python file at a time', 'danger');
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
        showAlert('File validation successful!', 'success');
    });

    // Handle stop button click
    stopBtn.click(function() {
        const serverUrl = getServerAddress();
        if (!serverUrl) {
            showAlert('Please enter a server URL/IP address', 'danger');
            return;
        }

        // Get the run ID from the response area
        let runId;
        try {
            const responseData = JSON.parse($('#responseArea').val());
            runId = responseData.run_id;
        } catch (e) {
            showAlert('No active run to stop', 'danger');
            return;
        }

        // Send stop request to the server
        $.ajax({
            url: `/protocols/stop/${runId}`,
            method: 'POST',
            data: { target_url: serverUrl },
            success: (response) => {
                showAlert('Run stopped successfully!', 'success');
                stopBtn.prop('disabled', true);
            },
            error: (xhr, status, error) => {
                const errorMsg = xhr.responseJSON?.message || error;
                showAlert('Error stopping run: ' + errorMsg, 'danger');
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
            
            // Show success message
            showAlert('Pipette movement command sent successfully!', 'success');
        } catch (error) {
            console.error('Error:', error);
            showAlert('Failed to move pipette: ' + error.message, 'danger');
        }
    });

    // Handle lighting toggle
    $('#lightingToggle').change(async function(event, skipRequest) {
        if (skipRequest) return; // Skip API call if we're just updating the UI
        
        const serverUrl = getServerAddress();
        if (!serverUrl) {
            showAlert('Please enter a server URL/IP address', 'danger');
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
            showAlert(`Lighting turned ${isOn ? 'on' : 'off'} successfully!`, 'success');
        } catch (error) {
            console.error('Error:', error);
            showAlert(`Failed to turn ${isOn ? 'on' : 'off'} lighting: ${error.message}`, 'danger');
            $(this).prop('checked', !isOn); // Revert toggle on error
        }
    });

    // Handle UV toggle
    $('#uvToggle').change(async function(event, skipRequest) {
        if (skipRequest) return; // Skip API call if we're just updating the UI
        
        const serverUrl = getServerAddress();
        if (!serverUrl) {
            showAlert('Please enter a server URL/IP address', 'danger');
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
            showAlert(`UV light turned ${isOn ? 'on' : 'off'} successfully!`, 'success');
        } catch (error) {
            console.error('Error:', error);
            showAlert(`Failed to turn ${isOn ? 'on' : 'off'} UV light: ${error.message}`, 'danger');
            $(this).prop('checked', !isOn); // Revert toggle on error
        }
    });

    // Handle refresh lights button
    refreshBtn.click(async function() {
        console.log('Refresh button clicked');
        const button = $(this);
        const serverUrl = getServerAddress();
        
        if (!serverUrl) {
            showAlert('Please enter a server URL/IP address', 'danger');
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
            
            $('#responseArea').val(JSON.stringify(result, null, 2));
            showAlert('Light status refreshed successfully!', 'success');
        } catch (error) {
            console.error('Error:', error);
            showAlert('Failed to refresh light status: ' + error.message, 'danger');
        } finally {
            // Reset loading state
            button.prop('disabled', false);
            button.find('i').removeClass('fa-spin');
        }
    });

    function handleFile(file) {
        if (!file) return;
        
        // Validate file type
        if (!file.name.toLowerCase().endsWith('.py') && !file.name.toLowerCase().endsWith('.json')) {
            showAlert('Please select a Python script (.py) or JSON (.json) file', 'danger');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showAlert('File size should not exceed 5MB', 'danger');
            return;
        }

        // Check if multiple files were dropped
        if (fileInput[0].files.length > 1) {
            showAlert('Please upload only one Python file at a time', 'danger');
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
        // stopBtn.prop('disabled', true);
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
            showAlert('Please enter a server URL/IP address', 'danger');
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
                showAlert('Script uploaded successfully!', 'success');
                $('#responseArea').val(JSON.stringify(response, null, 2));
                uploadBtn.prop('disabled', true);
                stopBtn.prop('disabled', false);
                clearFile();
            },
            error: (xhr, status, error) => {
                const errorMsg = xhr.responseJSON?.message || error;
                showAlert('Error uploading script: ' + errorMsg, 'danger');
                $('#responseArea').val(xhr.responseJSON ? JSON.stringify(xhr.responseJSON, null, 2) : '');
                uploadBtn.prop('disabled', false);
                uploadProgress.hide();
            }
        });
    }

    function showAlert(message, type) {
        const alertBox = $('#alertBox');
        const alertMessage = $('#alertMessage');
        
        alertBox.removeClass('alert-success alert-danger')
               .addClass('alert-' + type + ' show');
        alertMessage.text(message);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            alertBox.removeClass('show');
        }, 5000);
    }
}); 