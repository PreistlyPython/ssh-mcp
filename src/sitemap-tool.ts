import { SSHSession } from './types.js';

export interface SitemapParams {
  sessionId: string;
  websiteRoot: string;
  websiteUrl: string;
  maxDepth?: number;
  exclude?: string[];
  baseFilePath?: string;
}

export interface PageData {
  path: string;
  lastModified?: string;
  changeFreq?: string;
  priority?: number;
}

export class SitemapTool {
  private readonly sessions: Map<string, SSHSession>;

  constructor(sessions: Map<string, SSHSession>) {
    this.sessions = sessions;
  }

  /**
   * Create or update a sitemap.xml file by crawling a website
   */
  async createOrUpdateSitemap(params: SitemapParams): Promise<string> {
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${params.sessionId}`);
    }

    if (!session.isConnected) {
      throw new Error(`Session ${params.sessionId} is not connected`);
    }

    // Normalize paths and URLs
    const websiteRoot = this.normalizePath(params.websiteRoot);
    const websiteUrl = this.normalizeUrl(params.websiteUrl);
    const maxDepth = params.maxDepth || 3;
    const exclude = params.exclude || [];
    const sitemapPath = params.baseFilePath || `${websiteRoot}/sitemap.xml`;

    console.error(`Starting sitemap generation for ${websiteUrl} (root: ${websiteRoot})`);

    try {
      // Step 1: Find all HTML files in the website directory
      console.error(`Finding all HTML files in ${websiteRoot}`);
      const allFiles = await this.findAllFiles(session, websiteRoot, maxDepth);
      
      // Step 2: Filter HTML files and convert to page data
      const htmlFiles = allFiles.filter(file => 
        file.endsWith('.html') || file.endsWith('.htm') || file.endsWith('.php') || 
        (!file.includes('.') && !this.isExcluded(file, exclude))
      );
      
      console.error(`Found ${htmlFiles.length} HTML files out of ${allFiles.length} total files`);
      
      // Step 3: Get last modified dates for each file
      const pages: PageData[] = await Promise.all(
        htmlFiles.map(async (file) => {
          const relativePath = file.replace(websiteRoot, '');
          const lastModified = await this.getLastModified(session, file);
          return {
            path: this.pathToUrl(relativePath, websiteUrl),
            lastModified,
            changeFreq: this.determineChangeFrequency(file),
            priority: this.calculatePriority(relativePath)
          };
        })
      );
      
      // Step 4: Generate sitemap XML
      const sitemapXml = this.generateSitemapXml(pages);
      
      // Step 5: Write sitemap to file
      await this.writeFile(session, sitemapPath, sitemapXml);
      
      return `Sitemap created successfully at ${sitemapPath} with ${pages.length} URLs`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create sitemap: ${errorMessage}`);
    }
  }

  /**
   * Find all files in a directory recursively
   */
  private async findAllFiles(
    session: SSHSession, 
    directory: string, 
    maxDepth: number, 
    currentDepth = 0
  ): Promise<string[]> {
    if (currentDepth > maxDepth) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const command = `find ${directory} -type f -not -path "*/\\.*" | sort`;
      
      session.client.exec(command, (err: any, stream: any) => {
        if (err) {
          reject(new Error(`Failed to find files: ${err.message}`));
          return;
        }

        let output = "";
        let errorOutput = "";

        stream.on("data", (data: Buffer) => {
          output += data.toString();
        });

        stream.stderr.on("data", (data: Buffer) => {
          errorOutput += data.toString();
        });

        stream.on("close", () => {
          if (errorOutput) {
            reject(new Error(`Command error: ${errorOutput}`));
          } else {
            const files = output
              .split('\n')
              .filter(line => line.trim().length > 0);
            resolve(files);
          }
        });
      });
    });
  }

  /**
   * Get the last modified date for a file
   */
  private async getLastModified(session: SSHSession, filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const command = `stat -c %y "${filePath}" 2>/dev/null || date -Iseconds`;
      
      session.client.exec(command, (err: any, stream: any) => {
        if (err) {
          resolve(new Date().toISOString()); // Fallback to current date
          return;
        }

        let output = "";

        stream.on("data", (data: Buffer) => {
          output += data.toString();
        });

        stream.on("close", () => {
          try {
            // Format the date as ISO string
            const date = new Date(output.trim());
            resolve(date.toISOString());
          } catch (e) {
            resolve(new Date().toISOString());
          }
        });
      });
    });
  }

  /**
   * Write content to a file
   */
  private async writeFile(session: SSHSession, filePath: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create parent directory if it doesn't exist
      const parentDir = filePath.substring(0, filePath.lastIndexOf('/'));
      const mkdirCommand = `mkdir -p "${parentDir}"`;
      
      session.client.exec(mkdirCommand, (err: any) => {
        if (err) {
          reject(new Error(`Failed to create directory: ${err.message}`));
          return;
        }
        
        // Write the file using a temp file to avoid issues with permissions
        const tempFile = `${filePath}.tmp`;
        const writeCommand = `cat > "${tempFile}" && mv "${tempFile}" "${filePath}"`;
        
        session.client.exec(writeCommand, (err: any, stream: any) => {
          if (err) {
            reject(new Error(`Failed to write file: ${err.message}`));
            return;
          }
          
          stream.end(content);
          
          stream.on("close", () => {
            resolve();
          });
          
          stream.stderr.on("data", (data: Buffer) => {
            reject(new Error(`Write error: ${data.toString()}`));
          });
        });
      });
    });
  }

  /**
   * Generate XML sitemap from page data
   */
  private generateSitemapXml(pages: PageData[]): string {
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ];

    pages.forEach(page => {
      xml.push('  <url>');
      xml.push(`    <loc>${this.escapeXml(page.path)}</loc>`);
      
      if (page.lastModified) {
        xml.push(`    <lastmod>${page.lastModified}</lastmod>`);
      }
      
      if (page.changeFreq) {
        xml.push(`    <changefreq>${page.changeFreq}</changefreq>`);
      }
      
      if (page.priority !== undefined) {
        xml.push(`    <priority>${page.priority.toFixed(1)}</priority>`);
      }
      
      xml.push('  </url>');
    });

    xml.push('</urlset>');
    return xml.join('\n');
  }

  /**
   * Convert a file path to a URL
   */
  private pathToUrl(path: string, baseUrl: string): string {
    // Remove leading slash if present
    if (path.startsWith('/')) {
      path = path.substring(1);
    }
    
    // Convert index.html to directory
    if (path === 'index.html' || path === 'index.htm' || path === 'index.php') {
      return baseUrl;
    }
    
    if (path.endsWith('/index.html') || path.endsWith('/index.htm') || path.endsWith('/index.php')) {
      path = path.substring(0, path.lastIndexOf('/'));
    }
    
    // Convert file extensions
    path = path.replace(/\.(html|htm|php)$/, '');
    
    // Join with base URL
    return `${baseUrl}${path ? '/' + path : ''}`;
  }

  /**
   * Check if a path is excluded based on patterns
   */
  private isExcluded(path: string, excludePatterns: string[]): boolean {
    return excludePatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(path);
      }
      return path.includes(pattern);
    });
  }

  /**
   * Normalize a file path
   */
  private normalizePath(path: string): string {
    return path.endsWith('/') ? path.slice(0, -1) : path;
  }

  /**
   * Normalize a URL
   */
  private normalizeUrl(url: string): string {
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Determine change frequency based on file path
   */
  private determineChangeFrequency(path: string): string {
    if (path.includes('/blog/') || path.includes('/news/')) {
      return 'weekly';
    }
    if (path.includes('/about/') || path.includes('/contact/')) {
      return 'monthly';
    }
    if (path.endsWith('index.html') || path === '/') {
      return 'daily';
    }
    return 'monthly';
  }

  /**
   * Calculate priority based on path depth
   */
  private calculatePriority(path: string): number {
    const depth = (path.match(/\//g) || []).length;
    
    if (path === '' || path === '/') {
      return 1.0;
    }
    
    // Lower priority for deeper pages
    return Math.max(0.1, 1.0 - (depth * 0.2));
  }
}
