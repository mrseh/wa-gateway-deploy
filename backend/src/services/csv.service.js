/**
 * CSV Service
 * Parse and validate CSV files for bulk messaging
 */

const fs = require('fs');
const csv = require('csv-parser');
const { parse } = require('csv-parse/sync');

class CSVService {
  async parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      const errors = [];
      let rowNumber = 0;

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          rowNumber++;
          
          // Validate row
          const validation = this.validateRecipient(row, rowNumber);
          
          if (validation.valid) {
            results.push({
              phone: this.formatPhoneNumber(row.phone || row.number || row.Phone || row.Number),
              name: row.name || row.Name || '',
              ...row, // Include all columns for template variables
            });
          } else {
            errors.push({
              row: rowNumber,
              data: row,
              errors: validation.errors,
            });
          }
        })
        .on('end', () => {
          // Remove duplicates based on phone number
          const uniqueResults = this.removeDuplicates(results);
          
          resolve({
            data: uniqueResults,
            errors,
            total: rowNumber,
            valid: uniqueResults.length,
            invalid: errors.length,
            duplicates: results.length - uniqueResults.length,
          });
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  validateRecipient(row, rowNumber) {
    const errors = [];

    // Check for phone number
    const phone = row.phone || row.number || row.Phone || row.Number;
    if (!phone) {
      errors.push('Missing phone number');
    } else {
      // Validate phone format
      const phoneStr = String(phone).replace(/\D/g, '');
      if (phoneStr.length < 10 || phoneStr.length > 15) {
        errors.push('Invalid phone number format');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  formatPhoneNumber(phone) {
    if (!phone) return '';
    
    // Remove all non-digit characters
    let cleaned = String(phone).replace(/\D/g, '');
    
    // Add country code if not present (default to Indonesia +62)
    if (!cleaned.startsWith('62') && !cleaned.startsWith('0')) {
      cleaned = '62' + cleaned;
    }
    
    // Remove leading 0 if present and add 62
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    }
    
    return cleaned;
  }

  removeDuplicates(recipients) {
    const seen = new Set();
    return recipients.filter(recipient => {
      const phone = recipient.phone;
      if (seen.has(phone)) {
        return false;
      }
      seen.add(phone);
      return true;
    });
  }

  generateSampleCSV() {
    return `phone,name,custom1,custom2
6282216328142,John Doe,Value1,Value2
6289876543210,Jane Smith,Value3,Value4
628123456789,Bob Johnson,Value5,Value6`;
  }

  extractVariables(template) {
    const regex = /\{\{(\w+)\}\}/g;
    const variables = new Set();
    let match;
    
    while ((match = regex.exec(template)) !== null) {
      variables.add(match[1]);
    }
    
    return Array.from(variables);
  }

  replaceVariables(template, data) {
    let message = template;
    
    // Replace {{variable}} with data
    const variables = template.match(/\{\{(\w+)\}\}/g);
    
    if (variables) {
      variables.forEach(variable => {
        const key = variable.replace(/\{\{|\}\}/g, '');
        const value = data[key] || '';
        message = message.replace(variable, value);
      });
    }
    
    return message;
  }

  validateTemplate(template, recipients) {
    const variables = this.extractVariables(template);
    const missingVars = [];
    
    // Check if all variables exist in at least one recipient
    if (recipients.length > 0) {
      const sampleRecipient = recipients[0];
      variables.forEach(varName => {
        if (!(varName in sampleRecipient)) {
          missingVars.push(varName);
        }
      });
    }
    
    return {
      valid: missingVars.length === 0,
      variables,
      missingVars,
    };
  }
}

module.exports = new CSVService();
