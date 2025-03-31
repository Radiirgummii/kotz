import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument, rgb } from 'pdf-lib';

type Unit = (value: number) => number;

const units: Record<string, Unit> = {
    g: (value: number) => value,
    kg: (value: number) => value * 1000,
    l: (value: number) => value,
    ml: (value: number) => value * 0.001,
    st: (value: number) => value,
};

interface Ingredient {
    unit: string;
}

interface Recipe {
    ingredients: Record<string, number>;
}

interface Data {
    ingredients: Record<string, Ingredient>;
    recepies: Record<string, Recipe>;
}

class Menu {
    private data: Data;
    private menu: Record<string, number>;
    private ingList: Record<string, number>;
    private participants: number;
    private pdfDoc: PDFDocument;

    constructor(datafile: string = 'data.json', menutext: Record<string, number> = {}, participants: number = 25) {
        const dataContent = fs.readFileSync(datafile, 'utf-8');
        this.data = JSON.parse(dataContent);
        this.menu = menutext;
        this.ingList = {};
        this.participants = participants;
        this.pdfDoc = PDFDocument.create();
    }

    private addIngredients(meal: string, count: number): void {
        const recipe = this.data.recepies[meal];
        for (const [ingredient, quantity] of Object.entries(recipe.ingredients)) {
            const unitFunc = units[this.data.ingredients[ingredient].unit];
            const amount = unitFunc(quantity);
            if (this.ingList[ingredient]) {
                this.ingList[ingredient] += amount * this.participants * count;
            } else {
                this.ingList[ingredient] = amount * this.participants * count;
            }
        }
    }

    private async addGeneralIngList(): Promise<void> {
        const page = this.pdfDoc.addPage();
        this.adjustUnits(this.ingList);
        const table = this.renderTable(Object.keys(this.ingList), Object.values(this.ingList));
        page.drawText(table, { x: 50, y: 700, size: 12, color: rgb(0, 0, 0) });
    }

    private async addMealIngList(meal: string, count: number): Promise<void> {
        const page = this.pdfDoc.addPage();
        page.drawText(meal, { x: 50, y: 750, size: 12, color: rgb(0, 0, 0) });
        const ingList: Record<string, number> = {};
        const recipe = this.data.recepies[meal];
        for (const [ingredient, quantity] of Object.entries(recipe.ingredients)) {
            const unitFunc = units[this.data.ingredients[ingredient].unit];
            ingList[ingredient] = unitFunc(quantity) * this.participants;
        }
        const table = this.renderTable(Object.keys(ingList), Object.values(ingList));
        page.drawText(table, { x: 50, y: 700, size: 12, color: rgb(0, 0, 0) });
    }

    private adjustUnits(ingList: Record<string, number>): void {
        for (const [ingredient, quantity] of Object.entries(ingList)) {
            if (quantity >= units.g(1000)) {
                ingList[ingredient] = units.kg(quantity);
            } else if (quantity < units.l(1)) {
                ingList[ingredient] = units.ml(quantity);
            }
        }
    }

    private renderTable(row1: string[], row2: number[]): string {
        let table = '';
        for (let i = 0; i < row1.length; i++) {
            const key = row1[i];
            const value = row2[i];
            table += `|${key.padEnd(20)}|${value.toString().padStart(20)}|\n`;
        }
        return table;
    }

    public async calculate(): Promise<void> {
        for (const [meal, count] of Object.entries(this.menu)) {
            console.log(0, `adding ${meal}`);
            if (count !== 0) {
                await this.addMealIngList(meal, count);
                this.addIngredients(meal, count);
            }
        }
    }

    public async output(filename: string): Promise<void> {
        const pdfBytes = await this.pdfDoc.save();
        fs.writeFileSync(filename, pdfBytes);
    }
}

async function main(): Promise<void> {
    const menuContent = fs.readFileSync('menu.json', 'utf-8');
    const textmenu = JSON.parse(menuContent);
    const menu = new Menu('data.json', textmenu.meals, 20);
    await menu.calculate();
    await menu.addGeneralIngList();
    await menu.output('menu.pdf');
}

main().catch((err) => console.error(err));