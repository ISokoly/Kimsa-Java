import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InsumosComponent } from './insumos.component';

describe('SuppliesComponent', () => {
  let component: InsumosComponent;
  let fixture: ComponentFixture<InsumosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InsumosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InsumosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
