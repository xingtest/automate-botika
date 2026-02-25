import * as fs from 'fs';
import * as path from 'path';

/**
 * Artifact Helper - Handle artifact uploads to backend
 */
export class ArtifactHelper {
  static async uploadArtifact(
    backendUrl: string,
    runId: number,
    artifactType: string,
    filename: string,
    filePath: string,
    description?: string
  ): Promise<any> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const fileData = fs.readFileSync(filePath);
      const base64Data = fileData.toString('base64');

      const payload = {
        run_id: runId,
        artifact_type: artifactType,
        filename,
        file_data: base64Data,
        description: description || null
      };

      const response = await fetch(`${backendUrl}/api/artifacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      const result = await response.json();
      console.log(`✅ Uploaded ${artifactType}: ${filename} (ID: ${(result as any).id})`);
      return result;
    } catch (error: any) {
      console.warn(`⚠️ Failed to upload artifact: ${error.message}`);
      return null;
    }
  }


  private static async uploadMediaArtifacts(
    backendUrl: string,
    runId: number,
    mediaFolder: string
  ): Promise<void> {
    if (!fs.existsSync(mediaFolder)) {
      return;
    }

    const mediaFiles = fs.readdirSync(mediaFolder).filter(f => /\.(webm|mp3|wav|m4a|ogg)$/i.test(f));
    for (const mediaFile of mediaFiles) {
      const mediaPath = path.join(mediaFolder, mediaFile);
      const lower = mediaFile.toLowerCase();
      const artifactType = lower.includes('_audio_') ? 'qa_audio' : 'qa_video';
      const mediaLabel = artifactType === 'qa_audio' ? 'audio' : 'video';

      await this.uploadArtifact(
        backendUrl,
        runId,
        artifactType,
        mediaFile,
        mediaPath,
        `QA ${mediaLabel} artifact: ${mediaFile}`
      );
    }
  }

  /**
   * Upload report JSON file
   */
  static async uploadReportJSON(
    backendUrl: string,
    runId: number,
    summaryPath: string
  ): Promise<any> {
    return this.uploadArtifact(
      backendUrl,
      runId,
      'json',
      path.basename(summaryPath),
      summaryPath,
      'Test summary report in JSON format'
    );
  }

  /**
   * Upload all artifacts from a test run folder
   */
  static async uploadTestArtifacts(
    backendUrl: string,
    runId: number,
    reportFilename: string,
    idTest: string
  ): Promise<void> {
    try {
      const fullReportFolderName = `${reportFilename}-${idTest}`;
      
      // Upload JSON report
      const jsonPath = path.join('report', 'json', `${fullReportFolderName}-summary.json`);
      if (fs.existsSync(jsonPath)) {
        await this.uploadReportJSON(backendUrl, runId, jsonPath);
      }

      // Upload HTML report
      const htmlReportPath = path.join('report', 'html', fullReportFolderName, 'index.html');
      if (fs.existsSync(htmlReportPath)) {
        await this.uploadArtifact(
          backendUrl,
          runId,
          'html',
          `${idTest}-report.html`,
          htmlReportPath,
          'HTML test report with detailed results'
        );
      }

      // Upload screenshots
      const screenshotsFolder = path.join('report', 'html', fullReportFolderName, 'screenshots');
      if (fs.existsSync(screenshotsFolder)) {
        const screenshots = fs.readdirSync(screenshotsFolder).filter(f => 
          /\.(png|jpg|jpeg|gif)$/i.test(f)
        );

        for (const screenshot of screenshots) {
          const screenshotPath = path.join(screenshotsFolder, screenshot);
          await this.uploadArtifact(
            backendUrl,
            runId,
            'screenshot',
            screenshot,
            screenshotPath,
            `Test screenshot: ${screenshot}`
          );
        }
      }

      // Upload QA media captures
      const mediaFolder = path.join('report', 'html', fullReportFolderName, 'media');
      await this.uploadMediaArtifacts(backendUrl, runId, mediaFolder);
    } catch (error: any) {
      console.warn(`⚠️ Error uploading test artifacts: ${error.message}`);
    }
  }
}
