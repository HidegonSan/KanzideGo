//=============================================================================
// GitHub Auto Updater Plugin
//=============================================================================
/*:
 * @plugindesc Allows automatic updates from a GitHub repository.
 * @version 1.0.0
 * @author Your Name
 *
 * @param Owner
 * @desc GitHubユーザーの名前
 * @default your_owner
 *
 * @param Repo
 * @desc GitHubレポジトリの名前
 * @default your_repo
 * 
 * @param DPath
 * @desc ダウンロードする場所(基本は./でいいはずです)
 * @default ./
 * 
 * @param InitialSHA
 * @desc 最初期バージョンのSHA
 * @default initial_SHA
 * 
 * @help
 * Githubのほうに更新があったとき、変更箇所をダウンロードして適切な場所に配置してくれるスクリプトですが、まだいろいろと問題点があります。
 * 
 */

(function () {
    var parameters = PluginManager.parameters('GitHubAutoUpdater');
    var owner = String(parameters['Owner'] || 'your_owner');
    var repo = String(parameters['Repo'] || 'your_repo');
    var downloadPath = String(parameters['DPath'] || './');
    var initialSHA = String(parameters['InitialSHA'] || ' initial_SHA');

    const fs = require('fs');
    const path = require('path');

    var lastCommitSHA = localStorage.getItem('lastCommitSHA');

    function storeCommitSHA(commitSHA) {
        localStorage.setItem('lastCommitSHA', commitSHA);
    }

    if (navigator.onLine) {
        processCommits();
    }

    function getLatestCommitSHA(owner, repo) {
        try {
            var url = `https://api.github.com/repos/${owner}/${repo}/commits/main`;
            var response = require('child_process').execSync(`curl -s "${url}"`, { encoding: 'utf8' });
            var data = JSON.parse(response);
            return data.sha;
        } catch (error) {
            throw new Error(`GitHub APIからのコミットSHAの取得中にエラーが発生しました: ${error.message}`);
        }
    }

    function getCommitChanges(owner, repo, fromSHA, toSHA) {
        try {
            var url = `https://api.github.com/repos/${owner}/${repo}/compare/${fromSHA}...${toSHA}`;
            var response = require('child_process').execSync(`curl -s "${url}"`, { encoding: 'utf8' });
            var data = JSON.parse(response);
            return data.files;
        } catch (error) {
            throw new Error(`GitHub APIからのコミット間の変更の取得中にエラーが発生しました: ${error.message}`);
        }
    }

    async function processCommits() {
        try {
            var latestCommitSHA = await getLatestCommitSHA(owner, repo);
            if (lastCommitSHA === undefined) {
                lastCommitSHA = initialSHA;
            }
            if (lastCommitSHA !== latestCommitSHA) {
                const commitChanges = await getCommitChanges(owner, repo, lastCommitSHA, latestCommitSHA);
                for (const file of commitChanges) {
                    const fileName = path.join(downloadPath, file.filename);
                    if (file.status === 'removed') {
                        if (fs.existsSync(fileName)) {
                            fs.unlinkSync(fileName);
                            console.log(`ファイルを削除しました: ${fileName}`);
                        }
                    } else {
                        if (!fs.existsSync(fileName) || fs.readFileSync(fileName, 'utf8') !== file.content) {
                            await downloadFile(file);
                            console.log(`ダウンロード: ${file.filename}`);
                        }
                    }
                }
                lastCommitSHA = latestCommitSHA;
                storeCommitSHA(lastCommitSHA);
            }
        } catch (error) {
            console.error('エラー:', error.message);
        }
    }

    async function downloadFile(file) {
        const fileResponse = await fetch(fileUrl);
        const fileContent = await fileResponse.arrayBuffer();
        const fileUrl = file.raw_url;
        const fileName = path.join(downloadPath, file.filename);

        try {
            const response = await fetch(fileUrl);
            if (!response.ok) {
                throw new Error(`Failed to download file: ${response.statusText}`);
            }
            createDirectoryRecursive(path.dirname(fileName.replace(/\\/g, '/')));
            fs.writeFileSync(fileName, Buffer.from(fileContent), 'binary');
            console.log('ダウンロード: ' + file.filename);
        } catch (error) {
            throw new Error(`ファイルのダウンロード中にエラーが発生しました: ${error.message}`);
        }
    }

    /*
    async function DownLoad() {
        await downloadAllFiles("");
        storeCommitSHA(lastCommitSHA);
    }

    async function downloadAllFiles(dirPath = '') {
        const apiEndpoint = `https://api.github.com/repos/${owner}/${repo}/contents/${dirPath}`;
        const response = await fetch(apiEndpoint);
        const contents = await response.json();

        for (const content of contents) {
            const contentPath = content.path;
            const contentUrl = content.download_url;
            const fullPath = path.join(downloadPath, contentPath);

            if (content.type === 'file') {
                // ファイルをダウンロード
                const fileResponse = await fetch(contentUrl);
                const fileContent = await fileResponse.arrayBuffer();
                createDirectoryRecursive(path.dirname(fullPath));
                fs.writeFileSync(fullPath, Buffer.from(fileContent), 'binary');
            } else if (content.type === 'dir') {
                await downloadAllFiles(contentPath);
            }
        }
    }
    */

    function createDirectoryRecursive(dirPath) {
        var normalizedPath = path.normalize(dirPath);
        var parts = normalizedPath.split(path.sep);

        for (var i = 1; i <= parts.length; i++) {
            var directoryPath = path.join.apply(null, parts.slice(0, i));
            if (!fs.existsSync(directoryPath)) {
                fs.mkdirSync(directoryPath);
            }
        }
    }
})();
