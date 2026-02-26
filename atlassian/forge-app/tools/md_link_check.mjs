#!/usr/bin/env node
/**
 * md_link_check.mjs
 * Deterministic markdown link checker for relative links
 * Scans docs/**\/*.md for [text](relative/path) format
 * Fails with non-zero exit if broken links found
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

let brokenLinks = [];

/**
 * Recursively find all .md files in docs/
 */
function findMarkdownFiles(dir) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(findMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Extract relative markdown links from file content
 * Matches: [text](relative/path) but ignores http/https
 */
function extractLinks(content, filePath) {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links = [];
  let match;
  
  while ((match = linkRegex.exec(content)) !== null) {
    const url = match[2];
    // Skip http/https and anchor-only links
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('#')) {
      links.push({
        text: match[1],
        url: url,
        file: filePath,
        lineNum: content.substring(0, match.index).split('\n').length
      });
    }
  }
  
  return links;
}

/**
 * Check if a link target exists
 */
function linkExists(targetPath, fromDir) {
  try {
    const fullPath = path.resolve(fromDir, targetPath);
    // For links like "file.md" or "dir/file.md", check if file exists
    // For links like "dir/" (directory), check if index.md exists in that dir
    
    // Remove fragment (#) if present
    const pathWithoutFragment = targetPath.split('#')[0];
    
    if (pathWithoutFragment.endsWith('/')) {
      // Directory link - check for index.md
      const indexPath = path.resolve(fromDir, pathWithoutFragment, 'index.md');
      return fs.existsSync(indexPath);
    } else {
      // File link
      const resolved = path.resolve(fromDir, pathWithoutFragment);
      return fs.existsSync(resolved);
    }
  } catch (e) {
    return false;
  }
}

/**
 * Main function
 */
function main() {
  const docsDir = path.join(rootDir, 'docs');
  
  if (!fs.existsSync(docsDir)) {
    console.error(`ERROR: docs/ directory not found at ${docsDir}`);
    process.exit(2);
  }
  
  const mdFiles = findMarkdownFiles(docsDir);
  console.log(`Scanning ${mdFiles.length} markdown files...`);
  
  for (const filePath of mdFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const links = extractLinks(content, filePath);
    const fileDir = path.dirname(filePath);
    
    for (const link of links) {
      if (!linkExists(link.url, fileDir)) {
        brokenLinks.push({
          file: path.relative(rootDir, link.file),
          lineNum: link.lineNum,
          link: link.url,
          text: link.text
        });
      }
    }
  }
  
  if (brokenLinks.length > 0) {
    console.error('\n❌ Broken links found:\n');
    
    // Sort by file for deterministic output
    brokenLinks.sort((a, b) => {
      if (a.file !== b.file) return a.file.localeCompare(b.file);
      return a.lineNum - b.lineNum;
    });
    
    for (const link of brokenLinks) {
      console.error(`${link.file}:${link.lineNum} - [${link.text}](${link.link})`);
    }
    
    console.error(`\nTotal: ${brokenLinks.length} broken link(s)\n`);
    process.exit(1);
  }
  
  console.log(`✅ All links verified (${mdFiles.length} files scanned)`);
  process.exit(0);
}

main();
