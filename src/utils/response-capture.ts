import { Page } from 'playwright';
import { Modul } from './modul';

/**
 * Comprehensive response capture utility for all platforms
 * Captures ALL bot response bubbles including the first one
 */
export class ResponseCapture {
  
  /**
   * Capture bot responses from webchat-like interfaces
   * @param page Playwright page object
   * @param question The question that was asked
   * @param selectors Custom selectors for the platform
   * @returns Array of response strings
   */
  static async captureWebchatResponses(
    page: Page,
    question: string,
    selectors: {
      botMessageSelector?: string;
      messageWrapperSelector?: string;
      contentSelector?: string;
    } = {}
  ): Promise<string[]> {
    const replies: string[] = [];
    
    // Default selectors
    const wrapperSelector = selectors.messageWrapperSelector || '.message-content-wrapper';
    const contentSelector = selectors.contentSelector || '.content';
    
    try {
      console.log(`🔍 Capturing bot responses for: "${question}"`);
      
      // Wait for messages to stabilize
      await Modul.waitTime(2);
      
      // Get all message wrappers
      const allMessages = await page.locator(wrapperSelector).all();
      console.log(`📊 Total messages: ${allMessages.length}`);
      
      // Find the question index (search from end to start for most recent)
      let questionIndex = -1;
      for (let i = allMessages.length - 1; i >= 0; i--) {
        try {
          const contents = await allMessages[i].locator(contentSelector).all();
          for (const content of contents) {
            const text = await content.textContent();
            if (text && text.trim().toLowerCase() === question.trim().toLowerCase()) {
              questionIndex = i;
              console.log(`✅ Found question at index ${i}`);
              break;
            }
          }
          if (questionIndex >= 0) break;
        } catch {}
      }
      
      if (questionIndex < 0) {
        console.log('⚠️ Question not found, cannot capture responses');
        return replies;
      }
      
      // Capture bot responses after question until next user message
      console.log(`📝 Capturing from index ${questionIndex + 1}...`);
      
      for (let i = questionIndex + 1; i < allMessages.length; i++) {
        try {
          const messageWrapper = allMessages[i];
          
          // Check if this is a user message - STOP here
          const hasUserClass = await messageWrapper.evaluate((el) => {
            return el.classList.contains('user') ||
                   el.closest('.user') !== null ||
                   el.querySelector('.user') !== null;
          });
          
          if (hasUserClass) {
            console.log(`🛑 Stopped at index ${i} (next user message)`);
            break;
          }
          
          // Get all content parts from this bot message
          const contentParts = await messageWrapper.locator(contentSelector).all();
          for (const part of contentParts) {
            const text = await part.textContent();
            if (text && text.trim() &&
                !text.includes('Ketik pesan') &&
                text.trim().length > 2) {
              replies.push(text.trim());
              console.log(`  ✅ Bot message ${replies.length}: "${text.substring(0, 60)}..."`);
            }
          }
        } catch (error: any) {
          console.log(`  ⚠️ Error at index ${i}: ${error.message}`);
        }
      }
      
      console.log(`📊 Captured ${replies.length} bot responses`);
      
    } catch (error) {
      console.error('❌ Error:', error);
    }

    // Remove duplicates while preserving order
    const uniqueReplies = [...new Set(replies)].filter(reply => 
      reply.toLowerCase() !== question.trim().toLowerCase()
    );

    console.log(`📋 Total responses captured: ${uniqueReplies.length}`);
    return uniqueReplies;
  }
  
  /**
   * Capture text-based responses (for Telegram, etc.)
   * @param messages Array of message objects
   * @param question The question that was asked
   * @returns Array of response strings
   */
  static captureTextResponses(messages: any[], question: string): string[] {
    const replies: string[] = [];
    
    try {
      console.log(`🔍 Capturing text responses for: "${question.substring(0, 50)}..."`);
      
      // Find question index
      let questionIndex = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const text = msg.text || msg.message || '';
        if (text.trim().toLowerCase() === question.trim().toLowerCase()) {
          questionIndex = i;
          console.log(`Found question at index ${i}`);
          break;
        }
      }
      
      // Get all messages after question
      if (questionIndex >= 0) {
        for (let i = questionIndex + 1; i < messages.length; i++) {
          const msg = messages[i];
          const text = msg.text || msg.message || '';
          if (text && text.trim() && text.length > 2) {
            replies.push(text.trim());
            console.log(`✅ Response: "${text.substring(0, 50)}..."`);
          }
        }
      } else {
        // Fallback: get recent messages
        const recentMessages = messages.slice(-5);
        for (const msg of recentMessages) {
          const text = msg.text || msg.message || '';
          if (text && text.trim() && 
              text.trim().toLowerCase() !== question.trim().toLowerCase() &&
              text.length > 3) {
            replies.push(text.trim());
          }
        }
      }
      
    } catch (error) {
      console.error('Error capturing text responses:', error);
    }
    
    console.log(`📋 Total text responses: ${replies.length}`);
    return replies;
  }
}
