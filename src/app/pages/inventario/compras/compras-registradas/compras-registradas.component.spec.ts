import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComprasRegistradasComponent } from './compras-registradas.component';

describe('ComprasRegistradasComponent', () => {
  let component: ComprasRegistradasComponent;
  let fixture: ComponentFixture<ComprasRegistradasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComprasRegistradasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ComprasRegistradasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
