// main.ts
import { Plugin, Menu, TFile, Notice, TAbstractFile } from 'obsidian';

interface CanvasData {
    nodes: CanvasNode[];
    edges: CanvasEdge[];
}

interface CanvasNode {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    file?: string;
    text?: string;
}

interface CanvasEdge {
    id: string;
    fromNode: string;
    fromSide: string;
    toNode: string;
    toSide: string;
}

export default class CanvasCreatorPlugin extends Plugin {
    async onload() {
        console.log('Canvas Creator Plugin loaded');

        // 注册文件管理器右键菜单
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
                // 检查是否是canvas文件
                if (file instanceof TFile && file.extension === 'canvas') {
                    menu.addItem((item) => {
                        item
                            .setTitle('创建并添加Canvas')
                            .setIcon('plus-square')
                            .onClick(async () => {
                                await this.createAndAddCanvasToFile(file);
                            });
                    });
                }
            })
        );

        // 保留原有的编辑器右键菜单（在canvas视图中右键）
        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu: Menu, editor, view) => {
                // 检查是否在canvas视图中
                if (view && view.getViewType() === 'canvas') {
                    menu.addItem((item) => {
                        item
                            .setTitle('创建并添加Canvas')
                            .setIcon('plus-square')
                            .onClick(async () => {
                                const canvasFile = (view as any).file;
                                if (canvasFile) {
                                    await this.createAndAddCanvasToFile(canvasFile);
                                }
                            });
                    });
                }
            })
        );

        // 添加命令
        this.addCommand({
            id: 'create-and-add-canvas',
            name: '创建并添加Canvas到当前Canvas',
            checkCallback: (checking: boolean) => {
                const activeView = this.app.workspace.getActiveViewOfType('canvas' as any);
                if (activeView) {
                    if (!checking) {
                        const canvasFile = (activeView as any).file;
                        if (canvasFile) {
                            this.createAndAddCanvasToFile(canvasFile);
                        }
                    }
                    return true;
                }
                return false;
            }
        });
    }

    async createAndAddCanvasToFile(targetCanvasFile: TFile) {
        try {
            // 1. 确保canvas-tmp文件夹存在
            const folderPath = 'canvas-tmp';
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            
            if (!folder) {
                await this.app.vault.createFolder(folderPath);
                console.log('创建文件夹: canvas-tmp');
            }

            // 2. 生成唯一的canvas文件名
            const timestamp = Date.now();
            const canvasFileName = `canvas-${timestamp}.canvas`;
            const canvasFilePath = `${folderPath}/${canvasFileName}`;

            // 3. 创建新的canvas文件（空canvas）
            const emptyCanvasData: CanvasData = {
                nodes: [],
                edges: []
            };

            const newCanvasFile = await this.app.vault.create(
                canvasFilePath, 
                JSON.stringify(emptyCanvasData, null, 2)
            );

            console.log('创建新Canvas文件:', canvasFilePath);

            // 4. 读取目标canvas文件的数据
            const currentCanvasContent = await this.app.vault.read(targetCanvasFile);
            const currentCanvasData: CanvasData = JSON.parse(currentCanvasContent);

            // 5. 计算新节点的位置（所有元素的右下角）
            const newNodePosition = this.calculateBottomRightPosition(currentCanvasData.nodes);

            // 6. 创建新的canvas节点
            const newNode: CanvasNode = {
                id: this.generateNodeId(),
                type: 'file',
                x: newNodePosition.x,
                y: newNodePosition.y,
                width: 400,
                height: 300,
                file: canvasFilePath
            };

            // 7. 添加新节点到目标canvas
            currentCanvasData.nodes.push(newNode);

            // 8. 保存更新后的canvas
            await this.app.vault.modify(
                targetCanvasFile, 
                JSON.stringify(currentCanvasData, null, 2)
            );

            // 9. 如果当前正在查看这个canvas，刷新视图
            const activeView = this.app.workspace.getActiveViewOfType('canvas' as any);
            if (activeView && (activeView as any).file?.path === targetCanvasFile.path) {
                if ((activeView as any).requestSave) {
                    (activeView as any).requestSave();
                }
                // 尝试刷新canvas视图
                setTimeout(() => {
                    if ((activeView as any).requestParse) {
                        (activeView as any).requestParse();
                    }
                }, 100);
            }

            new Notice(`成功创建并添加Canvas: ${canvasFileName} 到 ${targetCanvasFile.name}`);

        } catch (error) {
            console.error('创建Canvas时出错:', error);
            new Notice('创建Canvas失败，请查看控制台获取详细信息');
        }
    }

    // 计算所有节点的右下角位置
    calculateBottomRightPosition(nodes: CanvasNode[]): { x: number, y: number } {
        if (nodes.length === 0) {
            // 如果没有节点，从原点开始
            return { x: 0, y: 0 };
        }

        let maxX = -Infinity;
        let maxY = -Infinity;

        // 找到所有节点的最右下角位置
        nodes.forEach(node => {
            const nodeRightX = node.x + node.width;
            const nodeBottomY = node.y + node.height;
            
            if (nodeRightX > maxX) {
                maxX = nodeRightX;
            }
            if (nodeBottomY > maxY) {
                maxY = nodeBottomY;
            }
        });

        // 在右下角留出一些间距
        return {
            x: maxX + 50,
            y: maxY + 50
        };
    }

    // 生成唯一的节点ID
    generateNodeId(): string {
        return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    onunload() {
        console.log('Canvas Creator Plugin unloaded');
    }
}
