/**
 * Schema Validation Script
 * 
 * This script validates SQL migration files against the established naming conventions
 * to ensure consistency across the database schema.
 * 
 * Usage: node validate_schema.js [path_to_migration_file]
 */

const fs = require('fs');
const path = require('path');

// Define naming conventions and patterns to check
const NAMING_CONVENTIONS = {
  columnNaming: {
    pattern: /^[a-z][a-z0-9_]*$/,
    message: 'Column names should use snake_case (lowercase with underscores)'
  },
  codeColumns: {
    pattern: /_code$/,
    message: 'Code columns should end with _code suffix'
  },
  descriptionColumns: {
    pattern: /_desc$/,
    message: 'Description columns should end with _desc suffix'
  },
  dateColumns: {
    pattern: /_date$/,
    message: 'Date columns should end with _date suffix'
  },
  amountColumns: {
    pattern: /_amount$/,
    message: 'Amount columns should end with _amount suffix'
  }
};

// Common column pairs that should follow the code/desc pattern
const CODE_DESC_PAIRS = [
  'claim_filing_indicator',
  'facility_type',
  'facility_code_qualifier',
  'claim_frequency_type',
  'admission_type',
  'admission_source',
  'patient_status',
  'assignment',
  'benefits_assignment'
];

/**
 * Extracts column definitions from SQL statements
 * @param {string} sql - SQL content to parse
 * @returns {Array} - Array of column definitions
 */
function extractColumnDefinitions(sql) {
  const columnDefinitions = [];
  
  // Match CREATE TABLE statements
  const createTableMatches = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([\s\S]*?)\);/gi);
  if (createTableMatches) {
    for (const match of createTableMatches) {
      // Extract column definitions from CREATE TABLE
      const columnsSection = match.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?\w+\s*\(([\s\S]*?)\);/i)[1];
      const columnLines = columnsSection.split(',').map(line => line.trim()).filter(line => line && !line.startsWith('PRIMARY KEY') && !line.startsWith('FOREIGN KEY'));
      
      for (const line of columnLines) {
        const columnMatch = line.match(/^(\w+)\s+([^,]+)/);
        if (columnMatch) {
          columnDefinitions.push({
            name: columnMatch[1],
            definition: columnMatch[2].trim()
          });
        }
      }
    }
  }
  
  // Match ALTER TABLE ADD COLUMN statements
  const alterTableMatches = sql.match(/ALTER\s+TABLE\s+\w+\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+([^,;]+)/gi);
  if (alterTableMatches) {
    for (const match of alterTableMatches) {
      const columnMatch = match.match(/ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+([^,;]+)/i);
      if (columnMatch) {
        columnDefinitions.push({
          name: columnMatch[1],
          definition: columnMatch[2].trim()
        });
      }
    }
  }
  
  return columnDefinitions;
}

/**
 * Validates column definitions against naming conventions
 * @param {Array} columnDefinitions - Array of column definitions
 * @returns {Array} - Array of validation errors
 */
function validateColumnDefinitions(columnDefinitions) {
  const errors = [];
  const columnNames = columnDefinitions.map(col => col.name);
  
  // Check each column against naming conventions
  for (const column of columnDefinitions) {
    // Check snake_case
    if (!NAMING_CONVENTIONS.columnNaming.pattern.test(column.name)) {
      errors.push(`Column '${column.name}': ${NAMING_CONVENTIONS.columnNaming.message}`);
    }
    
    // Check code/desc pairs
    for (const baseName of CODE_DESC_PAIRS) {
      if (column.name === `${baseName}_code`) {
        // If this is a code column, check if there's a corresponding desc column
        if (!columnNames.includes(`${baseName}_desc`)) {
          errors.push(`Column '${column.name}' should have a corresponding '${baseName}_desc' column`);
        }
      }
    }
    
    // Check date columns
    if (column.definition.toLowerCase().includes('date') || 
        column.definition.toLowerCase().includes('timestamp')) {
      if (!column.name.endsWith('_date') && !column.name.endsWith('_at')) {
        errors.push(`Date column '${column.name}': ${NAMING_CONVENTIONS.dateColumns.message}`);
      }
    }
    
    // Check amount columns
    if (column.definition.toLowerCase().includes('decimal') || 
        column.definition.toLowerCase().includes('numeric') ||
        column.definition.toLowerCase().includes('money')) {
      if (!column.name.endsWith('_amount') && 
          !column.name.includes('price') && 
          !column.name.includes('cost') &&
          !column.name.includes('fee')) {
        errors.push(`Amount column '${column.name}': ${NAMING_CONVENTIONS.amountColumns.message}`);
      }
    }
  }
  
  return errors;
}

/**
 * Main validation function
 * @param {string} filePath - Path to the migration file
 */
function validateMigrationFile(filePath) {
  try {
    console.log(`Validating schema in: ${filePath}`);
    
    // Read the file
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Extract column definitions
    const columnDefinitions = extractColumnDefinitions(sql);
    console.log(`Found ${columnDefinitions.length} column definitions`);
    
    // Validate column definitions
    const errors = validateColumnDefinitions(columnDefinitions);
    
    // Display results
    if (errors.length === 0) {
      console.log('✅ Validation passed! No schema inconsistencies found.');
    } else {
      console.log('❌ Validation failed with the following issues:');
      errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
      process.exit(1);
    }
  } catch (error) {
    console.error('Error validating migration file:', error.message);
    process.exit(1);
  }
}

// Main execution
if (process.argv.length < 3) {
  console.log('Usage: node validate_schema.js [path_to_migration_file]');
  process.exit(1);
}

const filePath = process.argv[2];
validateMigrationFile(filePath);
